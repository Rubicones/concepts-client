import { z } from "zod";
import { blankState, isKeyUnlocked, type QState } from "./logic";
import type { QPatch } from "./types";

/**
 * Autosave patches: key-level changes, validated, merged into the stored state.
 * Key-level merging is what makes conflicts harmless: if someone else saved in
 * between, the server re-reads and re-applies these keys (last writer per key).
 */

const KEY = /^(c\d{1,6}:)?[a-z][a-z0-9_]{0,60}$/;
const row = z.object({ a: z.string().max(400).optional(), b: z.string().max(1000).optional(), s: z.boolean().optional() }).strict();
const value = z.union([
  z.null(),
  z.string().max(4000),
  z.boolean(),
  z.number().finite(),
  z.array(z.union([z.string().max(400), row])).max(100),
  z.record(z.string().regex(/^[a-z]{1,20}$/), z.union([z.number().int().min(1).max(5), z.literal("decide")])),
]);

export const patchSchema = z
  .object({
    a: z.record(z.string().regex(KEY), value).optional(),
    flags: z.record(z.string().regex(KEY), z.enum(["file", "prefill"]).nullable()).optional(),
    meta: z
      .object({
        role: z.enum(["brand", "agency"]).nullable().optional(),
        mode: z.enum(["self", "call", "ai"]).nullable().optional(),
        clients: z
          .array(z.object({ id: z.string().regex(/^c\d{1,6}$/) }).strict())
          .min(1)
          .max(30)
          .optional(),
        legal: z
          .object({ company: z.string().max(160).optional(), name: z.string().max(160).optional(), caseStudy: z.boolean().optional() })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((p) => Object.keys(p.a ?? {}).length + Object.keys(p.flags ?? {}).length <= 400, "Too many changes at once.");

/** Fills gaps in a stored state (older rows, hand edits) so the UI can trust its shape. */
export function normalizeState(raw: unknown): QState {
  const b = blankState();
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<QState>;
  return {
    role: s.role === "brand" || s.role === "agency" ? s.role : null,
    mode: s.mode === "self" || s.mode === "call" || s.mode === "ai" ? s.mode : null,
    a: s.a && typeof s.a === "object" ? s.a : {},
    flags: s.flags && typeof s.flags === "object" ? s.flags : {},
    clients: Array.isArray(s.clients) && s.clients.length ? s.clients : b.clients,
    legal: s.legal && typeof s.legal === "object" ? s.legal : {},
  };
}

export class LockedError extends Error {
  constructor(public readonly keys: string[]) {
    super("This answer is locked while we review it.");
    this.name = "LockedError";
  }
}

/**
 * Applies a patch. `unlocked` is null while the questionnaire is a draft (all
 * editable), or the list of keys the studio unlocked with follow-up questions.
 * Signatures are never touched here; they go through signing only.
 */
export function applyPatch(state: QState, patch: QPatch, unlocked: string[] | null): QState {
  if (unlocked) {
    const blocked = [...Object.keys(patch.a ?? {}), ...Object.keys(patch.flags ?? {})].filter((k) => !isKeyUnlocked(k, unlocked));
    if (blocked.length || patch.meta) throw new LockedError(blocked.length ? blocked : ["meta"]);
  }
  const a = { ...state.a };
  const flags = { ...state.flags };
  for (const [k, v] of Object.entries(patch.a ?? {})) {
    if (v === null || v === undefined) delete a[k];
    else a[k] = v;
    delete flags[k];
  }
  for (const [k, f] of Object.entries(patch.flags ?? {})) {
    if (f) flags[k] = f;
    else delete flags[k];
  }
  const next: QState = { ...state, a, flags };
  const m = patch.meta;
  if (m) {
    if (m.role !== undefined) next.role = m.role;
    if (m.mode !== undefined) next.mode = m.mode;
    if (m.clients) {
      next.clients = m.clients;
      // A removed client takes its answers with it (the prototype's removeClient).
      const keep = new Set(m.clients.map((c) => c.id));
      for (const k of Object.keys(next.a)) {
        const scope = /^(c\d+):/.exec(k)?.[1];
        if (scope && !keep.has(scope)) delete next.a[k];
      }
    }
    if (m.legal) next.legal = { ...next.legal, ...m.legal };
  }
  return next;
}
