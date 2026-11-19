"use server";

import { z } from "zod";
import { NoViewerError, requireAccountViewer } from "@/lib/viewer";
import { TransitionError } from "@/lib/state-machine";
import * as R from "@/lib/review";
import type { CommentView } from "@/campaign/review";
import type { ActionResult } from "@/questionnaire/types";

async function run<T>(fn: () => Promise<T>, fallback: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof TransitionError) return { ok: false, error: err.message, code: err.code };
    if (err instanceof NoViewerError) return { ok: false, error: "Pick a brand to continue.", code: "forbidden" };
    if (err instanceof z.ZodError) return { ok: false, error: "Something in that request looks off. Refresh and try again.", code: "invalid" };
    console.error("[review action]", err);
    return { ok: false, error: fallback };
  }
}

const SAVE_FAILED = "We couldn't save that comment. Check your connection and try again.";
const SEND_FAILED = "We couldn't send that just now. Nothing was lost; try again in a moment.";

export async function addComment(input: unknown): Promise<ActionResult<CommentView>> {
  return run(async () => R.addComment(await requireAccountViewer(), input), SAVE_FAILED);
}

export async function editComment(id: string, input: unknown): Promise<ActionResult<CommentView>> {
  return run(async () => R.editComment(await requireAccountViewer(), id, input), SAVE_FAILED);
}

export async function deleteComment(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    await R.deleteComment(await requireAccountViewer(), id);
    return null;
  }, "We couldn't delete that comment. Try again in a moment.");
}

const version = z.number().int().nonnegative();

export async function approveDirection(campaignId: string, v: number, deliveryId: string, itemId: string) {
  return run(async () => {
    const r = await R.approveDirection(await requireAccountViewer(), z.uuid().parse(campaignId), version.parse(v), z.uuid().parse(deliveryId), z.string().min(1).max(200).parse(itemId));
    return { status: r.status, version: r.version };
  }, SEND_FAILED);
}

export async function requestRebuild(campaignId: string, v: number, deliveryId: string, reason: string) {
  return run(async () => {
    const r = await R.requestRebuild(await requireAccountViewer(), z.uuid().parse(campaignId), version.parse(v), z.uuid().parse(deliveryId), z.string().max(4000).parse(reason));
    return { status: r.status, version: r.version };
  }, SEND_FAILED);
}

/* ---------------- Test mode · Studio ---------------- */

const SIM_FAILED = "That didn't work. Check the server log.";

export async function simFormaBrands() {
  return run(async () => {
    await requireAccountViewer();
    return R.simFormaBrands();
  }, SIM_FAILED);
}

export async function simFormaCampaigns(brandId: string, need: "directions" | "final" = "directions") {
  return run(async () => {
    await requireAccountViewer();
    return R.simFormaCampaigns(brandId, need === "final" ? "final" : "directions");
  }, SIM_FAILED);
}

export async function simFormaDirections(brandId: string, campaignId: string) {
  return run(async () => {
    await requireAccountViewer();
    return R.simFormaDirections(brandId, campaignId);
  }, SIM_FAILED);
}

const sendSchema = z.object({
  campaignId: z.uuid(),
  version,
  formaBrandId: z.uuid(),
  formaCampaignId: z.uuid(),
  ids: z.array(z.string().min(1).max(200)).max(10),
  notes: z.record(z.string(), z.string().max(600)).default({}),
});

export async function simSendDirections(input: z.input<typeof sendSchema>) {
  return run(async () => {
    const i = sendSchema.parse(input);
    const r = await R.studioSendDirections(await requireAccountViewer(), i.campaignId, i.version, i.formaBrandId, i.formaCampaignId, i.ids, i.notes);
    return { status: r.status, version: r.version };
  }, SIM_FAILED);
}
