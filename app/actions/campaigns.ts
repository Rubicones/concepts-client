"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { NoViewerError, requireAccountViewer } from "@/lib/viewer";
import { TransitionError } from "@/lib/state-machine";
import * as C from "@/lib/campaigns";
import type { ActionResult } from "@/questionnaire/types";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    if (err instanceof TransitionError) return { ok: false, error: err.message, code: err.code };
    if (err instanceof NoViewerError) return { ok: false, error: "Pick a brand to continue.", code: "forbidden" };
    console.error("[campaign action]", err);
    return { ok: false, error: "We couldn't send that just now. Your brief is still here; try again in a moment." };
  }
}

/** Sends the brief; on success opens the new campaign. Safe to call twice. */
export async function sendBrief(input: unknown): Promise<ActionResult<{ id: string }>> {
  const res = await run(async () => C.createCampaign(await requireAccountViewer(), input));
  if (res.ok) redirect(`/campaigns/${res.data.id}?sent=1`);
  return res;
}

/** Agencies: which client brand the dashboard shows. Persistent. */
export async function pickBrand(brandId: string): Promise<void> {
  const viewer = await requireAccountViewer();
  const brands = await C.listBrands(viewer);
  if (!brands.some((b) => b.id === brandId)) throw new Error("Unknown brand.");
  (await cookies()).set(C.BRAND_COOKIE, brandId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function simAccept(id: string, version: number) {
  return run(async () => {
    const r = await C.studioAccept(await requireAccountViewer(), z.uuid().parse(id), version);
    return { status: r.status, version: r.version };
  });
}

export async function simCancel(id: string, version: number) {
  return run(async () => {
    const r = await C.studioCancel(await requireAccountViewer(), z.uuid().parse(id), version);
    return { status: r.status, version: r.version };
  });
}
