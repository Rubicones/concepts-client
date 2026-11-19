"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { SEC, questionById } from "@/questionnaire/schema";
import { answered, clientName, formatValue, makeCtx, parseStep, scopedKey, steps, sectionTitle, text, visible, type QState } from "@/questionnaire/logic";
import type { QuestionnaireView } from "@/questionnaire/types";
import { questionnaireLabel } from "@/lib/client-status";
import { simApprove, simRequestChanges } from "@/app/actions/questionnaire";
import { StatusPill } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

/**
 * Test mode · Studio (spec §6.1): performs the studio's questionnaire transitions
 * until Forma moderation exists. Approve, or ask follow-up questions on picked answers.
 */
export function StudioSimulator({ view, state }: { view: QuestionnaireView; state: QState }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const canAct = view.status === "submitted";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast({ title: r.error ?? "That didn't work.", tone: "err" });
        return;
      }
      toast({ title: done, tone: "ok" });
      setAsking(false);
      setPicked([]);
      setNote("");
      router.refresh();
    });
  }

  const withHalf = (key: string) => {
    const [scope, id] = key.includes(":") ? key.split(":") : [null, key];
    const half = questionById(id)?.half;
    return half ? [key, scopedKey(scope, half)] : [key];
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(380px,calc(100vw-32px))]">
      <motion.div layout transition={SPRING} className="overflow-hidden rounded-tile bg-deep text-white shadow-sheet">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <span className="size-2 rounded-full bg-orange" aria-hidden="true" />
          <span className="flex-1 text-small font-semibold uppercase tracking-[0.06em]">Test mode · Studio</span>
          <StatusPill {...questionnaireLabel[view.status]} className="h-6 px-2.5 text-caption" />
          <ChevronDownIcon size={16} className={cn("transition-transform", open ? "rotate-180" : "")} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/10">
              <div className="flex flex-col gap-3 p-4">
                <p className="text-caption text-white/70">
                  Questionnaire · v{view.version}
                  {!canAct && " · send it first to act as the studio"}
                </p>
                {!asking ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="inverse" disabled={!canAct || pending} state={pending ? "loading" : "idle"} onClick={() => run(() => simApprove(view.id, view.version), "Approved")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="!text-white hover:!bg-white/10" disabled={!canAct || pending} onClick={() => setAsking(true)}>
                      Ask questions…
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-small font-medium">Pick the answers to reopen</p>
                    <div className="max-h-64 overflow-auto rounded-tile-sm bg-white/5 p-2">
                      {steps(state)
                        .map(parseStep)
                        .filter((p) => SEC[p.sec])
                        .map((p) => {
                          const c = makeCtx(state, p.cid);
                          const qs = SEC[p.sec].qs.filter((q) => visible(state, p.cid, q) && q.type !== "tick");
                          return (
                            <div key={`${p.cid}|${p.sec}`} className="mb-2">
                              <p className="px-1 pb-1 text-caption font-semibold uppercase tracking-[0.06em] text-white/60">
                                {(p.cid ? clientName(state, p.cid) + " · " : "") + sectionTitle(state, p.sec, p.cid)}
                              </p>
                              {qs.map((q) => {
                                const key = scopedKey(p.cid, q.id);
                                const on = picked.includes(key);
                                const v = c.get(q.id);
                                return (
                                  <label key={key} className="flex cursor-pointer items-start gap-2 rounded-input px-1 py-1 text-small hover:bg-white/5">
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => setPicked((cur) => (on ? cur.filter((k) => !withHalf(key).includes(k)) : [...cur, ...withHalf(key)]))}
                                      className="mt-0.5 accent-orange"
                                    />
                                    <span>
                                      {text(q.label, c) || "Files"}
                                      <span className="block truncate text-caption text-white/50">
                                        {q.type === "files" ? "Uploads" : answered(state, p.cid, q) ? formatValue(v).slice(0, 80) : "No answer"}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          );
                        })}
                    </div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Your question to the client"
                      aria-label="Your question to the client"
                      className="min-h-20 resize-none rounded-input bg-white px-3 py-2 text-small text-navy [field-sizing:content]"
                    />
                    <div className="flex justify-between gap-2">
                      <Button size="sm" variant="ghost" className="!text-white hover:!bg-white/10" onClick={() => setAsking(false)}>
                        Back
                      </Button>
                      <Button
                        size="sm"
                        variant="attention"
                        disabled={!picked.length || !note.trim() || pending}
                        state={pending ? "loading" : "idle"}
                        onClick={() => run(() => simRequestChanges(view.id, view.version, picked, note), "Questions sent")}
                      >
                        Send {picked.length ? `(${picked.length})` : ""}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
