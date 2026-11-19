import "server-only";
import { z } from "zod";
import { db } from "./supabase";
import { isTestMode } from "./env";
import { isUuid } from "./r2-keys";
import { applyCampaignTransition, TransitionError, CONFLICT_MESSAGE } from "./state-machine";
import { getGalleryCampaign, listBrandCampaigns, listFormaBrands } from "./forma";
import type { Viewer } from "./viewer";
import { buildDirectionsSnapshot, MAX_COMMENT, type CommentView } from "@/campaign/review";
import type { DirectionSnapshot } from "@/campaign/types";

/**
 * Directions review on the server (spec §6.6). Comments are drafts on an open
 * delivery until the client decides; the decision goes through the state machine,
 * whose database function marks the delivery responded and the drafts sent in the
 * same transaction. A trigger refuses draft writes on a closed delivery, so a
 * comment can never slip in after the decision.
 */

type AccountViewer = Extract<Viewer, { kind: "account" }>;

const COMMENT_COLUMNS = "id, delivery_id, item_id, scene, format, lang, x, y, number, body, state, created_at";

function toView(r: Record<string, unknown>): CommentView {
  return {
    id: r.id as string,
    deliveryId: r.delivery_id as string,
    itemId: r.item_id as string,
    scene: (r.scene as string | null) ?? null,
    format: (r.format as string | null) ?? null,
    lang: (r.lang as string | null) ?? null,
    x: r.x === null || r.x === undefined ? null : Number(r.x),
    y: r.y === null || r.y === undefined ? null : Number(r.y),
    number: r.number as number,
    body: r.body as string,
    state: r.state as CommentView["state"],
    createdAt: r.created_at as string,
  };
}

/** Every comment on a campaign's directions rounds (used by getCampaign; the caller already checked ownership). */
export async function commentsForDeliveries(deliveryIds: string[]): Promise<CommentView[]> {
  if (!deliveryIds.length) return [];
  const { data, error } = await db().from("delivery_comments").select(COMMENT_COLUMNS).in("delivery_id", deliveryIds).order("number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toView);
}

interface OpenDelivery {
  id: string;
  campaignId: string;
  directions: DirectionSnapshot[];
}

/** The delivery, if it belongs to this viewer and is still waiting for the client's decision. */
async function openDelivery(viewer: AccountViewer, deliveryId: string): Promise<OpenDelivery> {
  if (!isUuid(deliveryId)) throw new TransitionError("not_found", "We couldn't find that.");
  const { data: d, error } = await db().from("deliveries").select("id, campaign_request_id, stage, status, items").eq("id", deliveryId).maybeSingle();
  if (error) throw error;
  if (!d) throw new TransitionError("not_found", "We couldn't find that.");
  const { data: c, error: cErr } = await db().from("campaign_requests").select("id, status").eq("id", d.campaign_request_id).eq("account_id", viewer.accountId).maybeSingle();
  if (cErr) throw cErr;
  if (!c) throw new TransitionError("not_found", "We couldn't find that.");
  if (d.stage !== "directions" || d.status !== "sent" || c.status !== "review_directions") {
    throw new TransitionError("conflict", "This round has already been sent. Refresh to see where it stands.");
  }
  const items = (d.items ?? {}) as { directions?: DirectionSnapshot[] };
  return { id: d.id, campaignId: c.id, directions: Array.isArray(items.directions) ? items.directions : [] };
}

const isClosedError = (e: unknown) => typeof (e as { message?: unknown })?.message === "string" && (e as { message: string }).message.includes("delivery_not_open");

const closed = () => new TransitionError("conflict", "This round has already been sent. Refresh to see where it stands.");

const coord = z.number().min(0).max(1);
const newCommentSchema = z
  .object({
    deliveryId: z.uuid(),
    itemId: z.string().min(1).max(200),
    scene: z.string().max(200).nullable(),
    format: z.string().max(20).nullable(),
    lang: z.string().max(20).nullable(),
    x: coord.nullable(),
    y: coord.nullable(),
    body: z.string().trim().min(1, "Write something first.").max(MAX_COMMENT, "Please keep it under 4,000 characters."),
  })
  .refine((v) => (v.x === null) === (v.y === null), "A pin needs both coordinates.");

export async function addComment(viewer: AccountViewer, raw: unknown): Promise<CommentView> {
  const parsed = newCommentSchema.safeParse(raw);
  if (!parsed.success) throw new TransitionError("invalid", parsed.error.issues[0]?.message ?? "Check the comment.");
  const input = parsed.data;
  const delivery = await openDelivery(viewer, input.deliveryId);
  const direction = delivery.directions.find((d) => d.id === input.itemId);
  if (!direction) throw new TransitionError("invalid", "That direction isn't part of this review.");
  const scene = input.scene && direction.scenes.includes(input.scene) ? input.scene : null;

  // Numbers are per direction and never reused, so a pin keeps its number while others are deleted.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: last, error: lErr } = await db()
      .from("delivery_comments")
      .select("number")
      .eq("delivery_id", delivery.id)
      .eq("item_id", input.itemId)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lErr) throw lErr;
    const { data, error } = await db()
      .from("delivery_comments")
      .insert({
        delivery_id: delivery.id,
        item_id: input.itemId,
        scene,
        format: input.format ?? direction.format,
        lang: input.lang ?? direction.lang,
        x: input.x,
        y: input.y,
        number: ((last?.number as number | undefined) ?? 0) + 1,
        body: input.body,
        author: viewer.account.name ?? null,
      })
      .select(COMMENT_COLUMNS)
      .single();
    if (!error) return toView(data);
    if (isClosedError(error)) throw closed();
    if (error.code !== "23505") throw error;
  }
  throw new TransitionError("conflict", CONFLICT_MESSAGE);
}

const editSchema = z
  .object({
    body: z.string().trim().min(1, "Write something first.").max(MAX_COMMENT, "Please keep it under 4,000 characters.").optional(),
    x: coord.optional(),
    y: coord.optional(),
  })
  .refine((v) => (v.x === undefined) === (v.y === undefined), "A pin needs both coordinates.");

async function ownDraft(viewer: AccountViewer, id: string) {
  if (!isUuid(id)) throw new TransitionError("not_found", "We couldn't find that comment.");
  const { data, error } = await db().from("delivery_comments").select("id, delivery_id, state, x").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new TransitionError("not_found", "We couldn't find that comment.");
  await openDelivery(viewer, data.delivery_id);
  if (data.state !== "draft") throw closed();
  return data;
}

export async function editComment(viewer: AccountViewer, id: string, raw: unknown): Promise<CommentView> {
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) throw new TransitionError("invalid", parsed.error.issues[0]?.message ?? "Check the comment.");
  const current = await ownDraft(viewer, id);
  const patch: Record<string, unknown> = {};
  if (parsed.data.body !== undefined) patch.body = parsed.data.body;
  // Only pins move; a general comment stays general.
  if (parsed.data.x !== undefined && current.x !== null) Object.assign(patch, { x: parsed.data.x, y: parsed.data.y });
  if (!Object.keys(patch).length) throw new TransitionError("invalid", "Nothing to change.");
  const { data, error } = await db().from("delivery_comments").update(patch).eq("id", id).eq("state", "draft").select(COMMENT_COLUMNS).maybeSingle();
  if (error) {
    if (isClosedError(error)) throw closed();
    throw error;
  }
  if (!data) throw closed();
  return toView(data);
}

export async function deleteComment(viewer: AccountViewer, id: string): Promise<void> {
  await ownDraft(viewer, id);
  const { error } = await db().from("delivery_comments").delete().eq("id", id).eq("state", "draft");
  if (error) {
    if (isClosedError(error)) throw closed();
    throw error;
  }
}

/** Approve one direction. Irreversible: the state machine and the database both refuse a second answer. */
export async function approveDirection(viewer: AccountViewer, campaignId: string, version: number, deliveryId: string, itemId: string) {
  const delivery = await openDelivery(viewer, deliveryId);
  if (delivery.campaignId !== campaignId) throw new TransitionError("not_found", "We couldn't find that.");
  return applyCampaignTransition({ actor: "client", viewer }, campaignId, version, {
    type: "approve",
    deliveryId,
    deliveryItems: { directions: delivery.directions },
    itemId,
  });
}

/** Ask for three new directions. The limit is counted on the server. */
export async function requestRebuild(viewer: AccountViewer, campaignId: string, version: number, deliveryId: string, reason: string) {
  const delivery = await openDelivery(viewer, deliveryId);
  if (delivery.campaignId !== campaignId) throw new TransitionError("not_found", "We couldn't find that.");
  return applyCampaignTransition({ actor: "client", viewer }, campaignId, version, { type: "rebuild", deliveryId, reason, rebuildsUsed: 0 });
}

/* ---------------- Test mode · Studio sends directions ---------------- */

async function ownCampaign(viewer: AccountViewer, id: string) {
  if (!isTestMode()) throw new TransitionError("forbidden", "Not available.");
  if (!isUuid(id)) throw new TransitionError("not_found", "We couldn't find that.");
  const { data, error } = await db().from("campaign_requests").select("id").eq("id", id).eq("account_id", viewer.accountId).maybeSingle();
  if (error) throw error;
  if (!data) throw new TransitionError("not_found", "We couldn't find that.");
}

export async function simFormaBrands() {
  if (!isTestMode()) throw new TransitionError("forbidden", "Not available.");
  return (await listFormaBrands()).map((b) => ({ id: b.id, name: b.name }));
}

export async function simFormaCampaigns(brandId: string, need: "directions" | "final" = "directions") {
  if (!isTestMode()) throw new TransitionError("forbidden", "Not available.");
  if (!isUuid(brandId)) throw new TransitionError("not_found", "We couldn't find that brand.");
  return (await listBrandCampaigns(brandId))
    .filter((c) => (need === "final" ? c.hasFinal : c.directionCount > 0))
    .map((c) => ({ id: c.id, name: c.name, directionCount: c.directionCount, archived: c.archived }));
}

export async function simFormaDirections(brandId: string, campaignId: string) {
  if (!isTestMode()) throw new TransitionError("forbidden", "Not available.");
  if (!isUuid(brandId) || !isUuid(campaignId)) throw new TransitionError("not_found", "We couldn't find that campaign.");
  const c = await getGalleryCampaign(brandId, campaignId);
  if (!c) throw new TransitionError("not_found", "We couldn't find that campaign.");
  return c.directions.map((d) => ({ id: d.id, title: d.title, idea: d.idea, format: d.format, scenes: d.scenes.length, keyframeSvg: d.keyframeSvg }));
}

/** Rebuilds the snapshot on the server from Forma (never trusts the browser's copy) and sends it. */
export async function studioSendDirections(
  viewer: AccountViewer,
  campaignId: string,
  version: number,
  formaBrandId: string,
  formaCampaignId: string,
  ids: string[],
  notes: Record<string, string>,
) {
  await ownCampaign(viewer, campaignId);
  if (!isUuid(formaBrandId) || !isUuid(formaCampaignId)) throw new TransitionError("not_found", "We couldn't find that campaign.");
  const source = await getGalleryCampaign(formaBrandId, formaCampaignId);
  if (!source) throw new TransitionError("not_found", "We couldn't find that campaign.");
  let items;
  try {
    items = buildDirectionsSnapshot(source.directions, ids, notes);
  } catch (e) {
    throw new TransitionError("invalid", (e as Error).message);
  }
  return applyCampaignTransition({ actor: "studio", author: "Test mode" }, campaignId, version, { type: "send_directions", items, sentBy: "Test mode" });
}
