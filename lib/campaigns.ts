import "server-only";
import { cookies } from "next/headers";
import { db } from "./supabase";
import { isTestMode } from "./env";
import { briefSchema, validateSetup, type BriefAnswers, type CampaignSetup } from "./brief";
import { applyCampaignTransition, TransitionError } from "./state-machine";
import { isUuid } from "./r2-keys";
import { commentsForDeliveries } from "./review";
import { exportsForDelivery } from "./exports";
import type { Viewer } from "./viewer";
import type { CampaignRequest } from "./db-types";
import type { BrandOption, CampaignDetail, CampaignEvent, CampaignSummary, DeliveryView, DirectionSnapshot, FinalSnapshot } from "@/campaign/types";
import type { ClientFile } from "@/questionnaire/types";

/**
 * Campaigns as the client knows them (spec §4, §6.3–6.5). Every query is scoped
 * by the viewer's account; status changes go through lib/state-machine.ts.
 */

type AccountViewer = Extract<Viewer, { kind: "account" }>;

export const BRAND_COOKIE = "tc_brand";

export async function listBrands(viewer: AccountViewer): Promise<BrandOption[]> {
  const { data, error } = await db().from("client_brands").select("id, name, scope:questionnaire_scope").eq("account_id", viewer.accountId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BrandOption[];
}

/** The brand an agency is looking at (cookie, persistent), or the account's only brand. */
export async function activeBrand(viewer: AccountViewer): Promise<{ brands: BrandOption[]; active: BrandOption | null }> {
  const brands = await listBrands(viewer);
  const picked = (await cookies()).get(BRAND_COOKIE)?.value;
  return { brands, active: brands.find((b) => b.id === picked) ?? brands[0] ?? null };
}

export async function questionnaireApproved(viewer: AccountViewer): Promise<boolean> {
  const { data, error } = await db().from("brand_questionnaires").select("status").eq("account_id", viewer.accountId).maybeSingle();
  if (error) throw error;
  return data?.status === "approved";
}

function parseDelivery(row: Record<string, unknown>): DeliveryView {
  const items = (row.items ?? {}) as { directions?: DirectionSnapshot[]; final?: FinalSnapshot };
  return {
    id: row.id as string,
    stage: row.stage as DeliveryView["stage"],
    round: row.round as number,
    status: row.status as DeliveryView["status"],
    directions: Array.isArray(items.directions) ? items.directions : [],
    final: items.final ?? null,
    sentAt: row.sent_at as string,
    response: (row.response as DeliveryView["response"]) ?? null,
    respondedAt: (row.responded_at as string | null) ?? null,
  };
}

/** The keyframe that best represents a campaign: the chosen direction, else the latest round's first. */
function thumbnailFor(deliveries: DeliveryView[], approvedItemId: string | null): string | null {
  const dirs = deliveries.filter((d) => d.stage === "directions").sort((a, b) => b.round - a.round);
  for (const d of dirs) {
    const chosen = approvedItemId ? d.directions.find((x) => x.id === approvedItemId) : null;
    if (chosen?.keyframeSvg) return chosen.keyframeSvg;
  }
  return dirs[0]?.directions.find((x) => x.keyframeSvg)?.keyframeSvg ?? null;
}

const toSetup = (s: unknown): CampaignSetup => {
  const v = (s ?? {}) as Partial<CampaignSetup>;
  return { kind: v.kind ?? "multi", formats: v.formats ?? [], languages: v.languages ?? [], lengths: v.lengths ?? [] };
};

export async function listCampaigns(viewer: AccountViewer, brandId: string | null): Promise<CampaignSummary[]> {
  let query = db()
    .from("campaign_requests")
    .select("id, name, status, setup, client_brand_id, updated_at, created_at, approved_item_id")
    .eq("account_id", viewer.accountId)
    .order("updated_at", { ascending: false });
  if (brandId) query = query.eq("client_brand_id", brandId);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((r) => r.id as string);
  const deliveries = new Map<string, DeliveryView[]>();
  if (ids.length) {
    const { data: ds, error: dErr } = await db()
      .from("deliveries")
      .select("id, campaign_request_id, stage, round, status, items, sent_at, response, responded_at")
      .in("campaign_request_id", ids)
      .eq("stage", "directions");
    if (dErr) throw dErr;
    for (const d of ds ?? []) {
      const list = deliveries.get(d.campaign_request_id as string) ?? [];
      list.push(parseDelivery(d));
      deliveries.set(d.campaign_request_id as string, list);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    setup: toSetup(r.setup),
    brandId: r.client_brand_id,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    thumbnail: thumbnailFor(deliveries.get(r.id) ?? [], r.approved_item_id),
  }));
}

export async function getCampaign(viewer: AccountViewer, id: string): Promise<CampaignDetail | null> {
  if (!isUuid(id)) return null;
  const { data: row, error } = await db().from("campaign_requests").select("*").eq("id", id).eq("account_id", viewer.accountId).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const c = row as CampaignRequest;
  const brief = c.brief as unknown as BriefAnswers;
  const [deliveriesRes, eventsRes, brandRes, refsRes] = await Promise.all([
    db().from("deliveries").select("*").eq("campaign_request_id", id).order("sent_at", { ascending: true }),
    db().from("client_events").select("id, type, payload, at").eq("campaign_request_id", id).eq("account_id", viewer.accountId).order("at", { ascending: true }),
    db().from("client_brands").select("name").eq("id", c.client_brand_id).maybeSingle(),
    brief?.fileIds?.length
      ? db().from("client_files").select("id, scope, name, size, category, status, created_at").eq("account_id", viewer.accountId).in("id", brief.fileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [deliveriesRes, eventsRes, brandRes, refsRes]) if (r.error) throw r.error;
  const deliveries = (deliveriesRes.data ?? []).map(parseDelivery);
  const latestFinal = deliveries.filter((d) => d.stage === "final").sort((a, b) => b.round - a.round)[0] ?? null;
  const [comments, exports] = await Promise.all([
    commentsForDeliveries(deliveries.filter((d) => d.stage === "directions").map((d) => d.id)),
    exportsForDelivery(latestFinal?.id ?? null),
  ]);
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    setup: toSetup(c.setup),
    brandId: c.client_brand_id,
    updatedAt: c.updated_at,
    createdAt: c.created_at,
    thumbnail: thumbnailFor(deliveries, c.approved_item_id),
    version: c.version,
    brief,
    rebuildsUsed: c.rebuilds_used,
    approvedItemId: c.approved_item_id,
    brandName: (brandRes.data?.name as string | undefined) ?? "",
    deliveries,
    events: (eventsRes.data ?? []) as CampaignEvent[],
    refs: ((refsRes.data ?? []) as Record<string, unknown>[]).map((f) => ({
      id: f.id as string,
      scope: f.scope as string,
      name: f.name as string,
      size: Number(f.size),
      category: f.category as string,
      status: f.status as ClientFile["status"],
      createdAt: f.created_at as string,
    })),
    comments,
    exports,
  };
}

/** Sends a brief. Idempotent: the same requestId (double click, retry) returns the campaign already created. */
export async function createCampaign(viewer: AccountViewer, raw: unknown): Promise<{ id: string; existed: boolean }> {
  const parsed = briefSchema.safeParse(raw);
  if (!parsed.success) throw new TransitionError("invalid", parsed.error.issues[0]?.message ?? "Check the brief.");
  const input = parsed.data;
  let setup: CampaignSetup;
  try {
    setup = validateSetup(input.setup);
  } catch (e) {
    throw new TransitionError("invalid", (e as Error).message);
  }
  if (!(await questionnaireApproved(viewer))) throw new TransitionError("forbidden", "Your questionnaire needs to be approved first.");
  const brands = await listBrands(viewer);
  if (!brands.some((b) => b.id === input.brandId)) throw new TransitionError("not_found", "We couldn't find that brand.");

  const { data: existing, error: exErr } = await db()
    .from("campaign_requests")
    .select("id")
    .eq("account_id", viewer.accountId)
    .eq("brief->>requestId", input.brief.requestId)
    .maybeSingle();
  if (exErr) throw exErr;
  if (existing) return { id: existing.id as string, existed: true };

  if (input.brief.fileIds.length) {
    const { data: files, error: fErr } = await db().from("client_files").select("id").eq("account_id", viewer.accountId).eq("status", "ready").in("id", input.brief.fileIds);
    if (fErr) throw fErr;
    input.brief.fileIds = (files ?? []).map((f) => f.id as string);
  }

  const { data, error } = await db()
    .from("campaign_requests")
    .insert({ account_id: viewer.accountId, client_brand_id: input.brandId, name: input.name, setup, brief: input.brief, status: "submitted" })
    .select("id")
    .single();
  if (error) throw error;
  const { error: evErr } = await db()
    .from("client_events")
    .insert({ account_id: viewer.accountId, campaign_request_id: data.id, type: "campaign.submitted", payload: { kind: setup.kind } });
  if (evErr) console.error("[campaigns] could not record the event:", evErr);
  return { id: data.id as string, existed: false };
}

/* ---------------- Test mode · Studio ---------------- */

async function ownCampaign(viewer: AccountViewer, id: string) {
  if (!isTestMode()) throw new TransitionError("forbidden", "Not available.");
  const { data, error } = await db().from("campaign_requests").select("id").eq("id", id).eq("account_id", viewer.accountId).maybeSingle();
  if (error) throw error;
  if (!data) throw new TransitionError("not_found", "We couldn't find that.");
}

export async function studioAccept(viewer: AccountViewer, id: string, version: number) {
  await ownCampaign(viewer, id);
  return applyCampaignTransition({ actor: "studio", author: "Test mode" }, id, version, { type: "accept" });
}

export async function studioCancel(viewer: AccountViewer, id: string, version: number) {
  await ownCampaign(viewer, id);
  return applyCampaignTransition({ actor: "studio", author: "Test mode" }, id, version, { type: "cancel" });
}
