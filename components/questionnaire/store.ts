"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveQuestionnaire } from "@/app/actions/questionnaire";
import { applyPatch } from "@/questionnaire/patch";
import type { EditResult, QState } from "@/questionnaire/logic";
import type { QPatch, QuestionnaireView } from "@/questionnaire/types";
import type { SaveState } from "@/components/shell/SaveIndicator";

/**
 * Client state + autosave (spec §6.2 Persistence).
 *
 * - Every edit applies at once (optimistic) and marks the keys it touched.
 * - ~600 ms after the last edit, the touched keys go to the server as a patch.
 *   The server merges key by key, so another tab's edits survive.
 * - Until the server confirms, the pending patch also lives in localStorage:
 *   closing the tab or losing the network never loses typing. It is re-applied
 *   on the next visit.
 * - Failures retry with backoff; the indicator says "Saving… / Saved / Offline".
 */

const DEBOUNCE_MS = 600;
type MetaKey = "role" | "mode" | "clients" | "legal";

interface Dirty {
  a: Set<string>;
  flags: Set<string>;
  meta: Set<MetaKey>;
}

const emptyDirty = (): Dirty => ({ a: new Set(), flags: new Set(), meta: new Set() });
const draftKey = (id: string) => `tc-questionnaire-draft:${id}`;

function diffInto(prev: QState, next: QState, d: Dirty) {
  for (const k of new Set([...Object.keys(prev.a), ...Object.keys(next.a)])) if (!Object.is(prev.a[k], next.a[k])) d.a.add(k);
  for (const k of new Set([...Object.keys(prev.flags), ...Object.keys(next.flags)])) if (prev.flags[k] !== next.flags[k]) d.flags.add(k);
  if (prev.role !== next.role) d.meta.add("role");
  if (prev.mode !== next.mode) d.meta.add("mode");
  if (prev.clients !== next.clients && JSON.stringify(prev.clients) !== JSON.stringify(next.clients)) d.meta.add("clients");
  if (prev.legal.company !== next.legal.company || prev.legal.name !== next.legal.name || prev.legal.caseStudy !== next.legal.caseStudy) d.meta.add("legal");
}

function buildPatch(s: QState, d: Dirty): QPatch | null {
  if (!d.a.size && !d.flags.size && !d.meta.size) return null;
  const patch: QPatch = {};
  if (d.a.size) patch.a = Object.fromEntries([...d.a].map((k) => [k, s.a[k] ?? null]));
  if (d.flags.size) patch.flags = Object.fromEntries([...d.flags].map((k) => [k, s.flags[k] ?? null]));
  if (d.meta.size) {
    patch.meta = {};
    if (d.meta.has("role")) patch.meta.role = s.role;
    if (d.meta.has("mode")) patch.meta.mode = s.mode;
    if (d.meta.has("clients")) patch.meta.clients = s.clients;
    if (d.meta.has("legal")) patch.meta.legal = { company: s.legal.company, name: s.legal.name, caseStudy: s.legal.caseStudy };
  }
  return patch;
}

function mergeDirty(into: Dirty, from: Dirty) {
  from.a.forEach((k) => into.a.add(k));
  from.flags.forEach((k) => into.flags.add(k));
  from.meta.forEach((k) => into.meta.add(k));
}

/** Server state, with whatever the user changed since the snapshot kept on top. */
function rebase(server: QState, local: QState, d: Dirty): QState {
  const a = { ...server.a };
  for (const k of d.a) {
    if (local.a[k] === undefined) delete a[k];
    else a[k] = local.a[k];
  }
  const flags = { ...server.flags };
  for (const k of d.flags) {
    if (local.flags[k] === undefined) delete flags[k];
    else flags[k] = local.flags[k];
  }
  return {
    role: d.meta.has("role") ? local.role : server.role,
    mode: d.meta.has("mode") ? local.mode : server.mode,
    clients: d.meta.has("clients") ? local.clients : server.clients,
    legal: d.meta.has("legal") ? { ...server.legal, company: local.legal.company, name: local.legal.name, caseStudy: local.legal.caseStudy } : server.legal,
    a,
    flags,
  };
}

export interface Store {
  state: QState;
  version: number;
  save: SaveState;
  /** Apply an edit. A returned `error` (e.g. "Up to 3") leaves state untouched and is reported. */
  edit: (fn: (s: QState) => QState | EditResult) => string | undefined;
  /** Replace state from a server action (signing), keeping local unsaved edits on top. */
  receive: (server: { state: QState; version: number }) => void;
  /** Save now; resolves with the confirmed version (or null if saving failed). */
  flush: () => Promise<number | null>;
  pending: boolean;
}

export function useQuestionnaireStore(initial: QuestionnaireView, editable: boolean, unlocked: string[] | null): Store {
  const [state, setState] = useState<QState>(initial.state);
  const [version, setVersion] = useState(initial.version);
  const [save, setSave] = useState<SaveState>("idle");
  const [pending, setPending] = useState(false);

  const stateRef = useRef(state);
  const versionRef = useRef(version);
  const dirty = useRef<Dirty>(emptyDirty());
  const inflight = useRef<Promise<number | null> | null>(null);
  const timer = useRef<number | null>(null);
  const retryDelay = useRef(2000);
  const id = initial.id;

  const commit = useCallback((next: QState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const writeDraft = useCallback(() => {
    try {
      const patch = buildPatch(stateRef.current, dirty.current);
      if (patch) localStorage.setItem(draftKey(id), JSON.stringify({ patch, at: Date.now() }));
      else localStorage.removeItem(draftKey(id));
    } catch {
      /* private mode or full storage: the server copy still saves */
    }
  }, [id]);

  const flushRef = useRef<() => Promise<number | null>>(async () => null);

  const schedule = useCallback((delay = DEBOUNCE_MS) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void flushRef.current();
    }, delay);
  }, []);

  const flush = useCallback(async (): Promise<number | null> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    const snapshot = dirty.current;
    const patch = buildPatch(stateRef.current, snapshot);
    if (!patch) return versionRef.current;
    dirty.current = emptyDirty();
    setSave("saving");
    setPending(true);
    const run = (async () => {
      const res = await saveQuestionnaire(id, patch).catch(() => null);
      if (res?.ok) {
        retryDelay.current = 2000;
        versionRef.current = res.data.version;
        setVersion(res.data.version);
        commit(rebase(res.data.state, stateRef.current, dirty.current));
        writeDraft();
        const more = dirty.current.a.size + dirty.current.flags.size + dirty.current.meta.size > 0;
        setSave(more ? "saving" : "saved");
        setPending(more);
        if (more) schedule();
        return res.data.version;
      }
      if (res && !res.ok && (res.code === "locked" || res.code === "invalid" || res.code === "forbidden")) {
        // Not retryable: the server refused this change. Drop it and say so.
        setSave("error");
        setPending(false);
        writeDraft();
        return null;
      }
      mergeDirty(dirty.current, snapshot);
      writeDraft();
      setSave(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
      schedule(retryDelay.current);
      retryDelay.current = Math.min(30000, retryDelay.current * 2);
      return null;
    })();
    inflight.current = run;
    try {
      return await run;
    } finally {
      inflight.current = null;
    }
  }, [id, commit, schedule, writeDraft]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const edit = useCallback(
    (fn: (s: QState) => QState | EditResult) => {
      if (!editable) return "This part is locked while we review your answers.";
      const prev = stateRef.current;
      const out = fn(prev);
      const next = "state" in out ? out.state : out;
      const error = "state" in out ? out.error : undefined;
      if (error || next === prev) return error;
      if (unlocked) {
        // While follow-up questions are open, only unlocked answers change.
        const probe = emptyDirty();
        diffInto(prev, next, probe);
        try {
          applyPatch(prev, buildPatch(next, probe) ?? {}, unlocked);
        } catch {
          return "This part is locked while we review your answers.";
        }
      }
      diffInto(prev, next, dirty.current);
      commit(next);
      writeDraft();
      setPending(true);
      setSave("saving");
      schedule();
      return undefined;
    },
    [editable, unlocked, commit, writeDraft, schedule],
  );

  const receive = useCallback(
    (server: { state: QState; version: number }) => {
      versionRef.current = server.version;
      setVersion(server.version);
      commit(rebase(server.state, stateRef.current, dirty.current));
    },
    [commit],
  );

  // Re-apply a draft that never reached the server (closed tab, offline). Deferred a tick so the
  // first paint matches the server render.
  useEffect(() => {
    if (!editable) return;
    const t = window.setTimeout(() => {
      let saved: { patch: QPatch } | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(draftKey(id)) ?? "null");
      } catch {
        saved = null;
      }
      if (!saved?.patch) return;
      try {
        const prev = stateRef.current;
        const next = applyPatch(prev, saved.patch, unlocked);
        diffInto(prev, next, dirty.current);
        commit(next);
        setPending(true);
        schedule(50);
      } catch {
        localStorage.removeItem(draftKey(id));
      }
    }, 0);
    return () => window.clearTimeout(t);
    // Run once per questionnaire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Warn before leaving with unsaved changes; save when the tab hides.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current.a.size || dirty.current.flags.size || dirty.current.meta.size || inflight.current) {
        e.preventDefault();
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    const onOnline = () => void flushRef.current();
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return { state, version, save, edit, receive, flush, pending };
}
