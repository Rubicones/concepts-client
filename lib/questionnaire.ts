import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./supabase";
import { isTestMode } from "./env";
import { clientFileKey, deleteObject, headObject, MAX_UPLOAD_BYTES, presignPut } from "./r2";
import { CURRENT, loadLegalDoc } from "./legal";
import { applyQuestionnaireTransition, TransitionError, CONFLICT_MESSAGE } from "./state-machine";
import type { Viewer } from "./viewer";
import type { BrandQuestionnaire } from "./db-types";
import { accountName, brandsForApproval, catOf, isAgency, legalOk, missingForSend, type QState, type Signature } from "@/questionnaire/logic";
import { applyPatch, LockedError, normalizeState } from "@/questionnaire/patch";
import type { ClientFile, QPatch, QuestionnaireNote, QuestionnaireView } from "@/questionnaire/types";
import type { LegalDocKey } from "./legal-parse";

/**
 * Server side of the brand questionnaire (spec §6.2). Every function is scoped
 * to the viewer's account; status rules live in lib/state-machine.ts.
 */

type AccountViewer = Extract<Viewer, { kind: "account" }>;

const MAX_CAS_RETRIES = 4;

function toView(row: BrandQuestionnaire, notes: QuestionnaireNote[], files: ClientFile[]): QuestionnaireView {
  return {
    id: row.id,
    accountId: row.account_id,
    status: row.status,
    version: row.version,
    state: normalizeState(row.state),
    unlocked: row.unlocked ?? [],
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    updatedAt: row.updated_at,
    notes,
    files,
  };
}

async function rowFor(viewer: AccountViewer, id?: string): Promise<BrandQuestionnaire> {
  let query = db().from("brand_questionnaires").select("*").eq("account_id", viewer.accountId);
  if (id) query = query.eq("id", id);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new TransitionError("not_found", "We couldn't find that.");
  return data as BrandQuestionnaire;
}

/** The viewer's questionnaire, created on first visit. */
export async function ensureQuestionnaire(viewer: AccountViewer): Promise<BrandQuestionnaire> {
  const { data, error } = await db().from("brand_questionnaires").select("*").eq("account_id", viewer.accountId).maybeSingle();
  if (error) throw error;
  if (data) return data as BrandQuestionnaire;
  const { data: created, error: insertError } = await db()
    .from("brand_questionnaires")
    .upsert({ account_id: viewer.accountId }, { onConflict: "account_id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (insertError) throw insertError;
  return (created as BrandQuestionnaire | null) ?? rowFor(viewer);
}

async function notesFor(questionnaireId: string): Promise<QuestionnaireNote[]> {
  const { data, error } = await db()
    .from("questionnaire_notes")
    .select("id, author_role, question_ids, body, created_at, resolved_at")
    .eq("questionnaire_id", questionnaireId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    authorRole: n.author_role,
    questionIds: n.question_ids ?? [],
    body: n.body,
    createdAt: n.created_at,
    resolvedAt: n.resolved_at,
  }));
}

async function filesFor(accountId: string): Promise<ClientFile[]> {
  const { data, error } = await db()
    .from("client_files")
    .select("id, scope, name, size, category, status, created_at")
    .eq("account_id", accountId)
    .neq("status", "failed")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((f) => ({ id: f.id, scope: f.scope, name: f.name, size: Number(f.size), category: f.category, status: f.status, createdAt: f.created_at }));
}

export async function loadQuestionnaire(viewer: AccountViewer): Promise<QuestionnaireView> {
  const row = await ensureQuestionnaire(viewer);
  const [notes, files] = await Promise.all([notesFor(row.id), filesFor(viewer.accountId)]);
  return toView(row, notes, files);
}

/** Keeps the account's name and kind in step with the answers (switcher, home, emails later). */
async function syncAccount(accountId: string, state: QState) {
  const name = accountName(state);
  const patch: Record<string, unknown> = { kind: state.role === "agency" ? "agency" : "brand" };
  if (name) patch.name = name;
  const { error } = await db().from("client_accounts").update(patch).eq("id", accountId);
  if (error) console.error("[questionnaire] could not sync the account name:", error);
}

/**
 * Compare-and-set update of the state. On a version race it re-reads and
 * re-applies `change` (key-level), so concurrent tabs never lose each other's typing.
 */
async function updateState(
  viewer: AccountViewer,
  id: string,
  change: (row: BrandQuestionnaire, state: QState) => QState,
): Promise<BrandQuestionnaire> {
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const row = await rowFor(viewer, id);
    const next = change(row, normalizeState(row.state));
    const { data, error } = await db()
      .from("brand_questionnaires")
      .update({ state: next, version: row.version + 1 })
      .eq("id", id)
      .eq("version", row.version)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (data) return data as BrandQuestionnaire;
  }
  throw new TransitionError("conflict", CONFLICT_MESSAGE);
}

function editableUnlocked(row: BrandQuestionnaire): string[] | null {
  if (row.status === "draft") return null;
  if (row.status === "changes_requested") return row.unlocked ?? [];
  throw new LockedError(["status"]);
}

export async function savePatch(viewer: AccountViewer, id: string, patch: QPatch): Promise<QuestionnaireView> {
  const touchesName = Boolean(patch.meta?.role !== undefined || patch.a?.c_company !== undefined || patch.a?.g_name !== undefined);
  const row = await updateState(viewer, id, (r, state) => applyPatch(state, patch, editableUnlocked(r)));
  const view = toView(row, [], []);
  if (touchesName) await syncAccount(viewer.accountId, view.state);
  return view;
}

export async function signDocument(
  viewer: AccountViewer,
  id: string,
  doc: LegalDocKey,
  who: { company: string; name: string },
  userAgent: string | null,
): Promise<QuestionnaireView> {
  const company = who.company.trim().slice(0, 160);
  const name = who.name.trim().slice(0, 160);
  if (!company || !name) throw new TransitionError("invalid", "Add the company and your name to sign.");
  const row = await rowFor(viewer, id);
  if (row.status !== "draft") throw new LockedError(["legal"]);
  const agency = isAgency(normalizeState(row.state));
  const rendered = await loadLegalDoc(doc, agency);
  const signature: Signature = {
    by: name,
    company,
    at: new Date().toISOString(),
    docVersion: CURRENT[doc],
    documentHash: rendered.hash,
    userAgent: userAgent?.slice(0, 400) ?? null,
  };
  const signed = await updateState(viewer, id, (r, state) => {
    if (r.status !== "draft") throw new LockedError(["legal"]);
    const legal = { ...state.legal, company, name, [doc]: signature };
    if (doc === "nda") legal.ndaOwn = false;
    return { ...state, legal };
  });
  return toView(signed, [], []);
}

export async function chooseOwnNda(viewer: AccountViewer, id: string): Promise<QuestionnaireView> {
  const row = await updateState(viewer, id, (r, state) => {
    if (r.status !== "draft") throw new LockedError(["legal"]);
    return { ...state, legal: { ...state.legal, ndaOwn: true, nda: null } };
  });
  return toView(row, [], []);
}

/** Send (or resend after follow-up questions). Completeness is checked on the server, from the stored answers. */
export async function submitQuestionnaire(viewer: AccountViewer, id: string, expectedVersion: number): Promise<QuestionnaireView> {
  const row = await rowFor(viewer, id);
  const state = normalizeState(row.state);
  const missing = missingForSend(state).filter((m) => m.label !== "NDA and terms");
  const next = await applyQuestionnaireTransition({ actor: "client", viewer }, id, expectedVersion, {
    type: "submit",
    missing: missing.map((m) => m.label),
    signatures: { nda: Boolean(state.legal.nda || state.legal.ndaOwn) && Boolean(state.legal.name && state.legal.company), terms: Boolean(state.legal.terms) && legalOk(state) },
  });
  if (row.status === "changes_requested") {
    const { error } = await db().from("questionnaire_notes").update({ resolved_at: new Date().toISOString() }).eq("questionnaire_id", id).is("resolved_at", null);
    if (error) console.error("[questionnaire] could not resolve notes:", error);
  }
  await syncAccount(viewer.accountId, state);
  return loadQuestionnaire(viewer).then((v) => ({ ...v, version: next.version }));
}

/** The client's reply to one of our follow-up questions; one reply per question, editable until resent. */
export async function saveReply(viewer: AccountViewer, id: string, noteId: string, body: string): Promise<QuestionnaireNote | null> {
  const row = await rowFor(viewer, id);
  if (row.status !== "changes_requested") throw new LockedError(["status"]);
  const { data: note, error } = await db()
    .from("questionnaire_notes")
    .select("id, question_ids, author_role, resolved_at")
    .eq("id", noteId)
    .eq("questionnaire_id", id)
    .maybeSingle();
  if (error) throw error;
  if (!note || note.author_role !== "studio" || note.resolved_at) throw new TransitionError("not_found", "That question was already answered.");
  const text = body.trim().slice(0, 4000);
  const ids = [`reply:${noteId}`, ...(note.question_ids ?? [])];
  const { data: existing } = await db()
    .from("questionnaire_notes")
    .select("id")
    .eq("questionnaire_id", id)
    .eq("author_role", "client")
    .is("resolved_at", null)
    .contains("question_ids", [`reply:${noteId}`])
    .maybeSingle();
  if (!text) {
    if (existing) await db().from("questionnaire_notes").delete().eq("id", existing.id);
    return null;
  }
  const { data, error: saveError } = existing
    ? await db().from("questionnaire_notes").update({ body: text }).eq("id", existing.id).select("*").single()
    : await db().from("questionnaire_notes").insert({ questionnaire_id: id, author_role: "client", question_ids: ids, body: text }).select("*").single();
  if (saveError) throw saveError;
  return { id: data.id, authorRole: "client", questionIds: data.question_ids, body: data.body, createdAt: data.created_at, resolvedAt: null };
}

/* ------------------------------------------------------------------ */
/* Files: browser → R2 directly with presigned PUTs (spec §4.2)        */
/* ------------------------------------------------------------------ */

function canEditFiles(row: BrandQuestionnaire, scope: string): boolean {
  // Campaign brief references: once the questionnaire is approved.
  if (scope === "refs") return row.status === "approved";
  if (row.status === "draft") return true;
  if (row.status !== "changes_requested") return false;
  const key = scope === "brand" ? "f_drop" : `${scope}:f_drop`;
  return (row.unlocked ?? []).includes(key);
}

export async function createUpload(
  viewer: AccountViewer,
  id: string,
  input: { scope: string; name: string; size: number; contentType: string; asBrief?: boolean },
): Promise<{ file: ClientFile; url: string; contentType: string }> {
  const row = await rowFor(viewer, id);
  const state = normalizeState(row.state);
  const scope = input.scope;
  if (scope !== "brand" && scope !== "refs" && !state.clients.some((c) => c.id === scope)) throw new TransitionError("invalid", "Pick a client first.");
  if (!canEditFiles(row, scope)) throw new LockedError(["files"]);
  if (!Number.isFinite(input.size) || input.size < 0 || input.size > MAX_UPLOAD_BYTES) {
    throw new TransitionError("invalid", "Files can be up to 2 GB. Split bigger ones, or share a link instead.");
  }
  const name = input.name.slice(0, 240) || "file";
  const contentType = /^[\w.+-]+\/[\w.+-]+$/.test(input.contentType) ? input.contentType : "application/octet-stream";
  const fileId = randomUUID();
  const r2Key = clientFileKey(viewer.accountId, fileId, name);
  const category = input.asBrief ? "Briefs" : scope === "refs" ? "References" : catOf(name);
  const { data, error } = await db()
    .from("client_files")
    .insert({ id: fileId, account_id: viewer.accountId, scope, name, size: input.size, content_type: contentType, category, r2_key: r2Key, status: "uploading" })
    .select("id, scope, name, size, category, status, created_at")
    .single();
  if (error) throw error;
  const url = await presignPut(r2Key, contentType);
  return {
    file: { id: data.id, scope: data.scope, name: data.name, size: Number(data.size), category: data.category, status: data.status, createdAt: data.created_at },
    url,
    contentType,
  };
}

async function fileRow(viewer: AccountViewer, fileId: string) {
  const { data, error } = await db().from("client_files").select("*").eq("id", fileId).eq("account_id", viewer.accountId).maybeSingle();
  if (error) throw error;
  if (!data) throw new TransitionError("not_found", "We couldn't find that file.");
  return data as { id: string; r2_key: string; size: number; status: string; scope: string };
}

/** After the browser's PUT: checks the object really arrived, whole. */
export async function confirmUpload(viewer: AccountViewer, fileId: string): Promise<"ready" | "failed"> {
  const f = await fileRow(viewer, fileId);
  const head = await headObject(f.r2_key);
  const status = head && head.size === Number(f.size) ? "ready" : "failed";
  const { error } = await db().from("client_files").update({ status }).eq("id", fileId);
  if (error) throw error;
  return status;
}

export async function removeFile(viewer: AccountViewer, id: string, fileId: string): Promise<void> {
  const row = await rowFor(viewer, id);
  const f = await fileRow(viewer, fileId);
  if (f.status === "ready" && !canEditFiles(row, f.scope)) throw new LockedError(["files"]);
  await deleteObject(f.r2_key).catch((err) => console.error("[files] could not delete object:", err));
  const { error } = await db().from("client_files").delete().eq("id", fileId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Test mode: "New brand" and the studio simulator (spec §6.1)          */
/* ------------------------------------------------------------------ */

function assertTestMode() {
  if (!isTestMode()) throw new TransitionError("forbidden", "Not available.");
}

export async function createTestAccount(): Promise<string> {
  assertTestMode();
  const { data, error } = await db().from("client_accounts").insert({ kind: "brand", test: true }).select("id").single();
  if (error) throw error;
  const { error: qError } = await db().from("brand_questionnaires").insert({ account_id: data.id });
  if (qError) throw qError;
  return data.id as string;
}

export async function studioApprove(viewer: AccountViewer, id: string, expectedVersion: number) {
  assertTestMode();
  const row = await rowFor(viewer, id);
  return applyQuestionnaireTransition({ actor: "studio", author: "Test mode" }, id, expectedVersion, {
    type: "approve",
    brands: brandsForApproval(normalizeState(row.state)),
  });
}

export async function studioRequestChanges(viewer: AccountViewer, id: string, expectedVersion: number, questionIds: string[], body: string) {
  assertTestMode();
  await rowFor(viewer, id);
  const text = body.trim().slice(0, 4000);
  if (!text || !questionIds.length) throw new TransitionError("invalid", "Write a question and pick the answers it concerns.");
  const { data: note, error } = await db()
    .from("questionnaire_notes")
    .insert({ questionnaire_id: id, author_role: "studio", author: "Test mode", question_ids: questionIds, body: text })
    .select("id")
    .single();
  if (error) throw error;
  try {
    return await applyQuestionnaireTransition({ actor: "studio", author: "Test mode" }, id, expectedVersion, {
      type: "request_changes",
      noteCount: 1,
      unlocked: questionIds,
    });
  } catch (err) {
    await db().from("questionnaire_notes").delete().eq("id", note.id);
    throw err;
  }
}
