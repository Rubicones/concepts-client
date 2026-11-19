import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./supabase";
import { getJson, listKeys } from "./r2";
import { isUuid } from "./r2-keys";
import {
  finalVariant,
  latestBrandVersions,
  referencedEntryIds,
  toGalleryCampaign,
  toSummary,
  variantsOf,
  type GalleryCampaign,
  type GalleryCampaignSummary,
  type OutputsById,
  type RawCampaignRow,
} from "./forma-map";

/**
 * Read-only access to Forma's data (spec §3.2, §5.1). The dashboard never writes
 * Forma rows or brand files. Cached for a few minutes: the gallery is for browsing.
 */

export interface FormaBrand {
  id: string;
  name: string;
  version: number;
}

interface BrandManifest {
  id: string;
  version: number;
  name: string;
  files?: { name: string; hash: string }[];
}

const CAMPAIGN_COLUMNS =
  "id, status, updated_at, created_at, name:doc->>name, setup:doc->setup, variants:doc->variants, active:doc->>activeVariant, steps:doc->steps";

export async function listFormaBrands(): Promise<FormaBrand[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("forma-brands");
  const latest = latestBrandVersions((await listKeys("brands/versions/")).map((k) => k.key));
  const brands = await Promise.all(
    [...latest].map(async ([id, version]) => {
      const m = await getJson<BrandManifest>(`brands/versions/${id}/${version}.json`).catch(() => null);
      return m ? { id, name: m.name?.trim() || "Untitled brand", version } : null;
    }),
  );
  return brands.filter((b): b is FormaBrand => b !== null).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFormaBrand(id: string): Promise<FormaBrand | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("forma-brands", `forma-brand:${id}`);
  if (!isUuid(id)) return null;
  const latest = latestBrandVersions((await listKeys(`brands/versions/${id}/`)).map((k) => k.key)).get(id);
  if (!latest) return null;
  const m = await getJson<BrandManifest>(`brands/versions/${id}/${latest}.json`);
  return m ? { id, name: m.name?.trim() || "Untitled brand", version: latest } : null;
}

async function outputsFor(ids: string[]): Promise<OutputsById> {
  const map: OutputsById = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await db().from("entries").select("id, output:doc->output").in("id", chunk);
    if (error) throw error;
    for (const row of data ?? []) map.set(row.id as string, (row.output as Record<string, unknown> | null) ?? null);
  }
  return map;
}

/** Every campaign of a Forma brand, newest first. Skips merged style forks, as Forma does. */
export async function listBrandCampaigns(brandId: string): Promise<GalleryCampaignSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("forma-campaigns", `forma-brand:${brandId}`);
  if (!isUuid(brandId)) return [];
  const { data, error } = await db()
    .from("entries")
    .select(CAMPAIGN_COLUMNS)
    .eq("type", "campaign")
    .eq("doc->>brandId", brandId)
    .or("status.is.null,status.neq.merged")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as RawCampaignRow[];

  // Covers: the style each active variant chose; for campaigns with a final, the final itself and its style.
  const ids = new Set<string>();
  for (const row of rows) {
    const vs = variantsOf(row);
    const active = vs.find((v) => v.id === row.active) ?? vs[0];
    if (active?.styles?.entryId) ids.add(active.styles.entryId);
    const fv = finalVariant(row);
    if (fv?.final?.entryId) ids.add(fv.final.entryId);
    if (fv?.styles?.entryId) ids.add(fv.styles.entryId);
  }
  const outputs = await outputsFor([...ids]);
  return rows.map((row) => toSummary(row, outputs));
}

export async function getGalleryCampaign(brandId: string, campaignId: string): Promise<GalleryCampaign | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("forma-campaigns", `forma-campaign:${campaignId}`);
  if (!isUuid(brandId) || !isUuid(campaignId)) return null;
  const { data, error } = await db()
    .from("entries")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", campaignId)
    .eq("type", "campaign")
    .eq("doc->>brandId", brandId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as RawCampaignRow;
  return toGalleryCampaign(row, await outputsFor(referencedEntryIds(row)));
}
