"use server";

import { z } from "zod";
import { NoViewerError, requireAccountViewer } from "@/lib/viewer";
import { TransitionError } from "@/lib/state-machine";
import * as E from "@/lib/exports";
import type { ActionResult } from "@/questionnaire/types";

async function run<T>(fn: () => Promise<T>, fallback: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof TransitionError) return { ok: false, error: err.message, code: err.code };
    if (err instanceof NoViewerError) return { ok: false, error: "Pick a brand to continue.", code: "forbidden" };
    if (err instanceof z.ZodError) return { ok: false, error: "Something in that request looks off. Refresh and try again.", code: "invalid" };
    console.error("[final action]", err);
    return { ok: false, error: fallback };
  }
}

/** Short-lived links for the chosen files (fileKey strings). */
export async function signDownloads(campaignId: string, keys: string[]) {
  return run(async () => E.signDownloads(await requireAccountViewer(), z.uuid().parse(campaignId), keys), "We couldn't prepare the download. Try again in a moment.");
}

/* ---------------- Test mode · Studio ---------------- */

const SIM_FAILED = "That didn't work. Check the server log.";

export async function simFormaFinal(brandId: string, campaignId: string) {
  return run(async () => {
    await requireAccountViewer();
    return E.simFormaFinal(brandId, campaignId);
  }, SIM_FAILED);
}

export async function simSendFinal(campaignId: string, version: number, formaBrandId: string, formaCampaignId: string) {
  return run(async () => {
    const r = await E.studioSendFinal(await requireAccountViewer(), z.uuid().parse(campaignId), z.number().int().nonnegative().parse(version), formaBrandId, formaCampaignId);
    return { status: r.status, version: r.version };
  }, SIM_FAILED);
}

export async function simSeedExports(campaignId: string) {
  return run(async () => E.studioSeedExports(await requireAccountViewer(), z.uuid().parse(campaignId)), SIM_FAILED);
}
