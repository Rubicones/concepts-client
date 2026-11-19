import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "./supabase";
import { isTestMode } from "./env";
import { isUuid, deliveryExportKey, presignGet, putObject } from "./r2";
import { applyCampaignTransition, TransitionError } from "./state-machine";
import { getGalleryCampaign } from "./forma";
import type { Viewer } from "./viewer";
import { buildFinalSnapshot, exportPath, fileKey, fileName, FILE_TYPES, type ExportFile, type FileType } from "@/campaign/final";
import type { FinalSnapshot } from "@/campaign/types";

/**
 * Final exports (spec §6.8). Rows come from `delivery_exports` (Forma's export job
 * writes them later); the browser downloads straight from R2 with short-lived
 * presigned URLs, so large deliveries never pass through this server.
 */

type AccountViewer = Extract<Viewer, { kind: "account" }>;

const EXPORT_COLUMNS = "format, lang, length, file_type, size, width, height, status, r2_key";

function toFile(r: Record<string, unknown>): ExportFile {
  return {
    format: r.format as string,
    lang: r.lang as string,
    length: Number(r.length) || 0,
    fileType: r.file_type as FileType,
    size: r.size === null || r.size === undefined ? null : Number(r.size),
    width: (r.width as number | null) ?? null,
    height: (r.height as number | null) ?? null,
    status: r.status as ExportFile["status"],
  };
}

/** Exports of one final delivery (the caller already checked ownership). */
export async function exportsForDelivery(deliveryId: string | null): Promise<ExportFile[]> {
  if (!deliveryId) return [];
  const { data, error } = await db().from("delivery_exports").select(EXPORT_COLUMNS).eq("delivery_id", deliveryId);
  if (error) throw error;
  return (data ?? []).map(toFile);
}

interface FinalContext {
  deliveryId: string;
  final: FinalSnapshot;
  campaignName: string;
  brandName: string;
}

/** The latest final delivery of a campaign the viewer owns. */
async function latestFinal(viewer: AccountViewer, campaignId: string): Promise<FinalContext> {
  if (!isUuid(campaignId)) throw new TransitionError("not_found", "We couldn't find that.");
  const { data: c, error } = await db().from("campaign_requests").select("id, name, status, client_brand_id").eq("id", campaignId).eq("account_id", viewer.accountId).maybeSingle();
  if (error) throw error;
  if (!c) throw new TransitionError("not_found", "We couldn't find that.");
  const [{ data: d, error: dErr }, { data: b, error: bErr }] = await Promise.all([
    db().from("deliveries").select("id, items").eq("campaign_request_id", campaignId).eq("stage", "final").order("round", { ascending: false }).limit(1).maybeSingle(),
    db().from("client_brands").select("name").eq("id", c.client_brand_id).maybeSingle(),
  ]);
  if (dErr) throw dErr;
  if (bErr) throw bErr;
  const final = (d?.items as { final?: FinalSnapshot } | undefined)?.final;
  if (!d || !final) throw new TransitionError("not_found", "The final isn't ready yet.");
  return { deliveryId: d.id, final, campaignName: c.name as string, brandName: (b?.name as string | undefined) ?? "" };
}

const keysSchema = z.array(z.string().max(120)).min(1).max(1000);

export interface SignedFile {
  key: string;
  url: string;
  /** Path inside the ZIP (Brand/Campaign/format/…). */
  path: string;
  size: number | null;
}

/** Short-lived download links for the chosen files. A single file gets its proper name as Content-Disposition. */
export async function signDownloads(viewer: AccountViewer, campaignId: string, rawKeys: unknown): Promise<SignedFile[]> {
  const keys = keysSchema.safeParse(rawKeys);
  if (!keys.success) throw new TransitionError("invalid", "Pick at least one file.");
  const ctx = await latestFinal(viewer, campaignId);
  const { data, error } = await db().from("delivery_exports").select(EXPORT_COLUMNS).eq("delivery_id", ctx.deliveryId).eq("status", "ready");
  if (error) throw error;
  const byKey = new Map((data ?? []).map((r) => [fileKey(toFile(r)), r]));
  const wanted = [...new Set(keys.data)].filter((k) => byKey.has(k));
  if (!wanted.length) throw new TransitionError("not_found", "Those files aren't available any more. Refresh to see what's ready.");
  const single = wanted.length === 1;
  return Promise.all(
    wanted.map(async (key) => {
      const row = byKey.get(key)!;
      const file = toFile(row);
      const p = exportPath(ctx.brandName, ctx.campaignName, file);
      return {
        key,
        path: p,
        size: file.size,
        url: await presignGet(row.r2_key as string, { downloadName: single ? fileName(p) : undefined, expiresIn: 60 * 60 }),
      };
    }),
  );
}

/* ---------------- Test mode · Studio ---------------- */

function testOnly() {
  if (!isTestMode()) throw new TransitionError("forbidden", "Not available.");
}

async function ownCampaign(viewer: AccountViewer, id: string) {
  testOnly();
  if (!isUuid(id)) throw new TransitionError("not_found", "We couldn't find that.");
  const { data, error } = await db().from("campaign_requests").select("id").eq("id", id).eq("account_id", viewer.accountId).maybeSingle();
  if (error) throw error;
  if (!data) throw new TransitionError("not_found", "We couldn't find that.");
}

export async function simFormaFinal(brandId: string, campaignId: string) {
  testOnly();
  if (!isUuid(brandId) || !isUuid(campaignId)) throw new TransitionError("not_found", "We couldn't find that campaign.");
  const c = await getGalleryCampaign(brandId, campaignId);
  if (!c?.final) throw new TransitionError("not_found", "That campaign has no final yet.");
  const f = c.final;
  return { id: f.id, title: f.title, kind: f.kind, formats: f.formats, langs: f.langs, lengths: f.lengths, keyframeSvg: f.keyframeSvg };
}

/** Rebuilds the final snapshot from Forma on the server and sends it. */
export async function studioSendFinal(viewer: AccountViewer, campaignId: string, version: number, formaBrandId: string, formaCampaignId: string) {
  await ownCampaign(viewer, campaignId);
  if (!isUuid(formaBrandId) || !isUuid(formaCampaignId)) throw new TransitionError("not_found", "We couldn't find that campaign.");
  const source = await getGalleryCampaign(formaBrandId, formaCampaignId);
  if (!source?.final) throw new TransitionError("not_found", "That campaign has no final yet.");
  let items;
  try {
    items = buildFinalSnapshot(source.final);
  } catch (e) {
    throw new TransitionError("invalid", (e as Error).message);
  }
  return applyCampaignTransition({ actor: "studio", author: "Test mode" }, campaignId, version, { type: "send_final", items, sentBy: "Test mode" });
}

const manifestSchema = z.object({
  files: z.array(
    z.object({
      file: z.string().regex(/^[A-Za-z0-9._-]+$/),
      format: z.string().nullable(),
      type: z.enum(FILE_TYPES),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  ),
});

const CONTENT_TYPE: Record<FileType, string> = { mp4: "video/mp4", webm: "video/webm", gif: "image/gif", png: "image/png", jpg: "image/jpeg" };

/**
 * Test mode: fills `delivery_exports` for the latest final from the sample files in
 * fixtures/exports/ — one video per format × language × length and a cover per
 * format × language (posters: stills only). Each sample is uploaded once and shared.
 */
export async function studioSeedExports(viewer: AccountViewer, campaignId: string): Promise<{ count: number }> {
  await ownCampaign(viewer, campaignId);
  const ctx = await latestFinal(viewer, campaignId);
  const dir = path.join(process.cwd(), "fixtures", "exports");
  const manifest = manifestSchema.parse(JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")));
  const pick = (format: string, type: FileType) =>
    manifest.files.find((m) => m.type === type && m.format === format) ?? manifest.files.find((m) => m.type === type && m.format === null) ?? manifest.files.find((m) => m.type === type);

  const uploaded = new Map<string, { key: string; size: number }>();
  async function upload(m: z.infer<typeof manifestSchema>["files"][number]) {
    const done = uploaded.get(m.file);
    if (done) return done;
    const body = new Uint8Array(await readFile(path.join(dir, m.file)));
    const key = deliveryExportKey(ctx.deliveryId, `sample-${m.file}`);
    await putObject(key, body, CONTENT_TYPE[m.type]);
    const out = { key, size: body.byteLength };
    uploaded.set(m.file, out);
    return out;
  }

  const rows: Record<string, unknown>[] = [];
  const f = ctx.final;
  const lengths = f.kind === "poster" ? [] : f.lengths.length ? f.lengths : [10];
  for (const format of f.formats) {
    const video = pick(format, "mp4");
    const still = pick(format, "png");
    for (const lang of f.langs) {
      if (video) {
        for (const length of lengths) {
          const u = await upload(video);
          rows.push({ delivery_id: ctx.deliveryId, format, lang, length, file_type: "mp4", r2_key: u.key, size: u.size, width: video.width, height: video.height, status: "ready" });
        }
      }
      if (still) {
        const u = await upload(still);
        rows.push({ delivery_id: ctx.deliveryId, format, lang, length: 0, file_type: "png", r2_key: u.key, size: u.size, width: still.width, height: still.height, status: "ready" });
      }
    }
  }
  if (!rows.length) throw new TransitionError("invalid", "No sample files match this final. Check fixtures/exports/manifest.json.");
  const { error } = await db().from("delivery_exports").upsert(rows, { onConflict: "delivery_id,format,lang,length,file_type" });
  if (error) throw error;
  return { count: rows.length };
}
