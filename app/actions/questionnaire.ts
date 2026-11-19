"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccountViewer, NoViewerError, VIEWER_COOKIE } from "@/lib/viewer";
import { TransitionError } from "@/lib/state-machine";
import { isTestMode } from "@/lib/env";
import * as Q from "@/lib/questionnaire";
import { LockedError, patchSchema } from "@/questionnaire/patch";
import type { ActionResult, ClientFile, QPatch, QuestionnaireNote, QuestionnaireView } from "@/questionnaire/types";

/**
 * Server actions for the questionnaire. Each returns a result object instead of
 * throwing, so the UI can keep the user's input and say what happened.
 */

const uuid = z.string().uuid();

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof TransitionError) return { ok: false, error: err.message, code: err.code === "forbidden" ? "forbidden" : err.code };
    if (err instanceof LockedError) return { ok: false, error: "This part is locked while we review your answers.", code: "locked" };
    if (err instanceof NoViewerError) return { ok: false, error: "Pick a brand to continue.", code: "forbidden" };
    if (err instanceof z.ZodError) return { ok: false, error: "Something in this change isn't valid. Refresh and try again.", code: "invalid" };
    console.error("[questionnaire action]", err);
    return { ok: false, error: "We couldn't save that just now. Your answers are kept on this device; we'll retry." };
  }
}

export async function saveQuestionnaire(id: string, patch: QPatch): Promise<ActionResult<Pick<QuestionnaireView, "version" | "state" | "updatedAt">>> {
  return run(async () => {
    const viewer = await requireAccountViewer();
    const v = await Q.savePatch(viewer, uuid.parse(id), patchSchema.parse(patch) as QPatch);
    return { version: v.version, state: v.state, updatedAt: v.updatedAt };
  });
}

export async function signLegal(id: string, doc: "nda" | "terms", who: { company: string; name: string }) {
  return run(async () => {
    const viewer = await requireAccountViewer();
    const ua = (await headers()).get("user-agent");
    const v = await Q.signDocument(viewer, uuid.parse(id), z.enum(["nda", "terms"]).parse(doc), who, ua);
    return { version: v.version, state: v.state };
  });
}

export async function sendOwnNda(id: string) {
  return run(async () => {
    const viewer = await requireAccountViewer();
    const v = await Q.chooseOwnNda(viewer, uuid.parse(id));
    return { version: v.version, state: v.state };
  });
}

export async function submitAnswers(id: string, expectedVersion: number): Promise<ActionResult<QuestionnaireView>> {
  return run(async () => {
    const viewer = await requireAccountViewer();
    return Q.submitQuestionnaire(viewer, uuid.parse(id), z.number().int().parse(expectedVersion));
  });
}

export async function saveNoteReply(id: string, noteId: string, body: string): Promise<ActionResult<QuestionnaireNote | null>> {
  return run(async () => {
    const viewer = await requireAccountViewer();
    return Q.saveReply(viewer, uuid.parse(id), uuid.parse(noteId), z.string().max(4000).parse(body));
  });
}

export async function startUpload(
  id: string,
  input: { scope: string; name: string; size: number; contentType: string; asBrief?: boolean },
): Promise<ActionResult<{ file: ClientFile; url: string; contentType: string }>> {
  return run(async () => {
    const viewer = await requireAccountViewer();
    const parsed = z
      .object({ scope: z.string().regex(/^(brand|refs|c\d{1,6})$/), name: z.string().min(1).max(500), size: z.number().nonnegative(), contentType: z.string().max(200), asBrief: z.boolean().optional() })
      .parse(input);
    return Q.createUpload(viewer, uuid.parse(id), parsed);
  });
}

export async function finishUpload(fileId: string): Promise<ActionResult<"ready" | "failed">> {
  return run(async () => Q.confirmUpload(await requireAccountViewer(), uuid.parse(fileId)));
}

export async function deleteUpload(id: string, fileId: string): Promise<ActionResult<null>> {
  return run(async () => {
    await Q.removeFile(await requireAccountViewer(), uuid.parse(id), uuid.parse(fileId));
    return null;
  });
}

/* ---------------- Test mode ---------------- */

/** "New brand": a fresh test account that starts at the welcome step, as a new client would. */
export async function createTestBrand(): Promise<void> {
  if (!isTestMode()) throw new Error("Not available.");
  const accountId = await Q.createTestAccount();
  (await cookies()).set(VIEWER_COOKIE, accountId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/questionnaire");
}

export async function simApprove(id: string, expectedVersion: number) {
  return run(async () => {
    const viewer = await requireAccountViewer();
    const row = await Q.studioApprove(viewer, uuid.parse(id), expectedVersion);
    return { version: row.version, status: row.status };
  });
}

export async function simRequestChanges(id: string, expectedVersion: number, questionIds: string[], body: string) {
  return run(async () => {
    const viewer = await requireAccountViewer();
    const ids = z.array(z.string().regex(/^(c\d{1,6}:)?[a-z][a-z0-9_]{0,60}$/)).min(1).max(100).parse(questionIds);
    const row = await Q.studioRequestChanges(viewer, uuid.parse(id), expectedVersion, ids, body);
    return { version: row.version, status: row.status };
  });
}
