"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "@/lib/motion";
import { SEC } from "@/questionnaire/schema";
import { isKeyUnlocked, parseStep, slugToStep, stepSlug, steps, totals, type QState } from "@/questionnaire/logic";
import type { ClientFile, LegalDocs, QuestionnaireView } from "@/questionnaire/types";
import { saveNoteReply, submitAnswers } from "@/app/actions/questionnaire";
import { useToast } from "@/components/ui/Toast";
import { Banner } from "@/components/ui/Feedback";
import { Button, buttonClass } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Dialog";
import { SaveIndicator } from "@/components/shell/SaveIndicator";
import { useQuestionnaireStore } from "./store";
import { QContext, type QCtx } from "./context";
import { useUploads } from "./Files";
import { Sidebar } from "./Sidebar";
import { DonePage, LegalPage, ReviewPage, SectionPage, WelcomePage } from "./Pages";
import { StudioSimulator } from "./StudioSimulator";

/**
 * The brand questionnaire (spec §6.2): a faithful port of the approved prototype
 * with server persistence. Steps are real URLs (/questionnaire/<step>) changed
 * client-side, so moving between sections is instant and every section can be linked.
 */

const SECTION_OF = new Map(Object.entries(SEC).flatMap(([sec, d]) => d.qs.map((q) => [q.id, sec] as const)));

function stepForKey(key: string): string | null {
  const [scope, id] = key.includes(":") ? key.split(":") : [null, key];
  const sec = SECTION_OF.get(id);
  return sec ? (scope ? `${scope}|${sec}` : sec) : null;
}

function defaultStep(view: QuestionnaireView): string {
  if (view.status === "changes_requested") {
    const first = view.notes.find((n) => n.authorRole === "studio" && !n.resolvedAt)?.questionIds[0];
    return (first && stepForKey(first)) || "review";
  }
  return view.status === "draft" ? "welcome" : "review";
}

const fmtSent = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

const subscribeNoop = () => () => {};

export function Questionnaire({ initial, legal, testMode }: { initial: QuestionnaireView; legal: LegalDocs; testMode: boolean }) {
  const router = useRouter();
  const pushToast = useToast();
  const toast = useCallback((title: string, tone: "info" | "ok" | "err" = "info") => pushToast({ title, tone }), [pushToast]);

  const status = initial.status;
  const editableStatus = status === "draft" || status === "changes_requested";
  const unlocked = status === "changes_requested" ? initial.unlocked : null;
  const store = useQuestionnaireStore(initial, editableStatus, unlocked);
  const s = store.state;

  const [files, setFiles] = useState<ClientFile[]>(initial.files);
  const uploads = useUploads(initial.id, setFiles, toast);
  const [navOpen, setNavOpen] = useState(false);
  const [teamNotes, setTeamNotes] = useState(false);
  const [sending, setSending] = useState(false);

  // Route → step.
  const pathname = usePathname();
  const slug = pathname.replace(/^\/questionnaire\/?/, "").split("/")[0] || null;
  let step = slugToStep(slug, s) ?? defaultStep(initial);
  if (step === "done" && status === "draft") step = "review";
  if (!steps(s).includes(step) && step !== "done") step = "welcome";

  const go = useCallback((st: string) => {
    window.history.pushState(null, "", `/questionnaire/${stepSlug(st)}`);
    window.scrollTo({ top: 0 });
    setNavOpen(false);
  }, []);

  // Follow-up questions and the client's replies.
  const openNotes = useMemo(() => (status === "changes_requested" ? initial.notes.filter((n) => n.authorRole === "studio" && !n.resolvedAt) : []), [initial.notes, status]);
  const [replies, setReplies] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const n of initial.notes) {
      const marker = n.questionIds.find((id) => id.startsWith("reply:"));
      if (n.authorRole === "client" && !n.resolvedAt && marker) out[marker.slice(6)] = n.body;
    }
    return out;
  });
  const replyTimers = useRef(new Map<string, number>());
  const replySaves = useRef(new Map<string, Promise<unknown>>());
  const setReply = useCallback(
    (noteId: string, body: string) => {
      setReplies((r) => ({ ...r, [noteId]: body }));
      const t = replyTimers.current.get(noteId);
      if (t) window.clearTimeout(t);
      replyTimers.current.set(
        noteId,
        window.setTimeout(() => {
          replyTimers.current.delete(noteId);
          const p = saveNoteReply(initial.id, noteId, body).then((r) => {
            if (!r.ok) toast("Couldn't save your reply. We'll keep it here; try again in a moment.", "err");
          });
          replySaves.current.set(noteId, p);
        }, 600),
      );
    },
    [initial.id, toast],
  );

  const canEdit = useCallback(
    (key: string) => {
      if (status === "draft") return true;
      if (status === "changes_requested") return isKeyUnlocked(key, initial.unlocked);
      return false;
    },
    [status, initial.unlocked],
  );

  const p = parseStep(step);
  const scope = p.cid;
  const readOnly = !editableStatus;

  const ctx: QCtx = {
    view: initial,
    store,
    scope,
    canEdit,
    readOnly,
    teamNotes: testMode && teamNotes,
    testMode,
    notesFor: (key) => openNotes.filter((n) => n.questionIds.includes(key)),
    replyFor: (id) => replies[id] ?? "",
    setReply,
    toast,
    go,
    files,
    uploads,
    legal,
  };

  async function send() {
    setSending(true);
    // Everything typed must be on the server before we check and lock it.
    for (const [noteId, t] of replyTimers.current) {
      window.clearTimeout(t);
      replyTimers.current.delete(noteId);
      replySaves.current.set(noteId, saveNoteReply(initial.id, noteId, replies[noteId] ?? ""));
    }
    await Promise.all(replySaves.current.values());
    const version = await store.flush();
    if (version === null) {
      setSending(false);
      toast("We couldn't save your latest answers. Check your connection and try again.", "err");
      return;
    }
    const r = await submitAnswers(initial.id, version);
    if (!r.ok) {
      setSending(false);
      toast(r.error, "err");
      return;
    }
    router.push("/questionnaire/done");
    router.refresh();
  }

  const t = totals(s);
  const pct = t.req ? Math.round((t.done / t.req) * 100) : 0;

  // Save status lives in the top bar (spec §6 shell).
  const statusSlot = useSyncExternalStore(subscribeNoop, () => document.getElementById("topbar-status"), () => null);

  return (
    <QContext value={ctx}>
      {statusSlot && editableStatus && createPortal(<SaveIndicator state={store.save} />, statusSlot)}

      {/* Phones: sections in a bottom sheet. */}
      <div className="sticky top-16 z-30 border-b border-line bg-white/90 px-3 py-2 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setNavOpen(true)} className="flex w-full items-center justify-between gap-3 rounded-full bg-gray px-4 py-2 text-small font-medium">
          <span>☰ Sections</span>
          <span className="tabular-nums text-muted">{pct}% done</span>
        </button>
      </div>
      <Sheet open={navOpen} onOpenChange={setNavOpen} side="bottom" title="Sections" hideTitle>
        <Sidebar step={step} onNavigate={() => setNavOpen(false)} />
      </Sheet>

      <div className="mx-auto grid w-full max-w-[var(--page-max)] gap-5 px-3 pb-24 pt-3 sm:px-[var(--gutter)] sm:pt-5 lg:grid-cols-[300px_1fr]">
        <aside className="sticky top-[84px] hidden max-h-[calc(100dvh-104px)] self-start overflow-auto rounded-card bg-gray p-5 lg:block">
          <Sidebar step={step} />
          {testMode && (
            <label className="mx-2 mt-4 flex cursor-pointer items-center gap-2 border-t border-line pt-3 text-caption text-muted">
              <input type="checkbox" checked={teamNotes} onChange={(e) => setTeamNotes(e.target.checked)} className="accent-navy" />
              Team notes (RU) · test mode
            </label>
          )}
        </aside>

        <main className="min-w-0">
          <StatusBanner view={initial} openCount={openNotes.length} onShow={() => go(defaultStep(initial))} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: EASE }}>
              {p.sec === "welcome" ? (
                <WelcomePage />
              ) : p.sec === "legal" ? (
                <LegalPage step={step} />
              ) : p.sec === "review" ? (
                <ReviewPage step={step} onSend={send} sending={sending} />
              ) : p.sec === "done" ? (
                <DonePage />
              ) : SEC[p.sec] ? (
                <SectionPage step={step} sec={p.sec} cid={p.cid} />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {testMode && <StudioSimulator view={initial} state={s as QState} />}
    </QContext>
  );
}

function StatusBanner({ view, openCount, onShow }: { view: QuestionnaireView; openCount: number; onShow: () => void }) {
  if (view.status === "submitted")
    return (
      <Banner tone="info" title="In review" className="mb-5">
        Sent {fmtSent(view.submittedAt)}. We&apos;ll read everything and get back to you within a day. Your answers are locked while we review.
      </Banner>
    );
  if (view.status === "changes_requested")
    return (
      <Banner
        tone="attention"
        title={`${openCount} question${openCount === 1 ? "" : "s"} for you`}
        className="mb-5"
        action={
          <Button size="sm" variant="primary" onClick={onShow}>
            Show me
          </Button>
        }
      >
        Only those answers are open. Everything else stays as you sent it. When you&apos;re done, send your answers from Check &amp; send.
      </Banner>
    );
  if (view.status === "approved")
    return (
      <Banner
        tone="ok"
        title="Approved"
        className="mb-5"
        action={
          <Link href="/" className={buttonClass({ variant: "primary", size: "sm" })}>
            Open your dashboard
          </Link>
        }
      >
        Thank you. Your dashboard is open: start your first campaign whenever you&apos;re ready.
      </Banner>
    );
  return null;
}
