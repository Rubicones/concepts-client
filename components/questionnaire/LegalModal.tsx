"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as RDialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING, surface } from "@/lib/motion";
import { signLegal } from "@/app/actions/questionnaire";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";
import { useQ } from "./context";
import { Tick } from "./Questions";

/**
 * NDA then terms, in one large window (prototype flow): read to the end to unlock
 * company, name and the tick; sign; the NDA leads straight into the terms.
 * The server stamps each signature with the document version, a hash of the
 * exact text, the time and the browser.
 */
export function LegalModal({ doc, onDoc }: { doc: "nda" | "terms" | null; onDoc: (d: "nda" | "terms" | null) => void }) {
  const Q = useQ();
  const open = doc !== null;
  const d = doc ? Q.legal[doc] : null;
  const legal = Q.store.state.legal;
  const [readToEnd, setReadToEnd] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const company = legal.company ?? "";
  const name = legal.name ?? "";

  // A new document starts unread and unticked; check once in case it fits without scrolling.
  const [seenDoc, setSeenDoc] = useState<string | null>(null);
  if (doc !== seenDoc) {
    setSeenDoc(doc);
    setReadToEnd(false);
    setTicked(false);
  }
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const el = body.current;
      if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadToEnd(true);
      el?.scrollTo({ top: 0 });
    }, 60);
    return () => window.clearTimeout(t);
  }, [open, doc]);

  const setWho = (field: "company" | "name", v: string) => Q.store.edit((s) => ({ ...s, legal: { ...s.legal, [field]: v } }));
  const ok = readToEnd && ticked && company.trim() && name.trim();
  const hint = !readToEnd ? "Scroll to the end to sign" : !(company.trim() && name.trim()) ? "Add the company and your name to sign" : ticked ? "Ready to sign" : "Tick the box to sign";

  async function sign() {
    if (!doc || !ok) return;
    setBusy(true);
    await Q.store.flush();
    const r = await signLegal(Q.view.id, doc, { company, name });
    setBusy(false);
    if (!r.ok) {
      Q.toast(r.error, "err");
      return;
    }
    Q.store.receive(r.data);
    if (doc === "nda") onDoc("terms");
    else {
      onDoc(null);
      Q.toast("Both documents signed", "ok");
    }
  }

  return (
    <RDialog.Root open={open} onOpenChange={(o) => !o && !busy && onDoc(null)}>
      <AnimatePresence>
        {open && d && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={surface} className="fixed inset-0 z-50 bg-deep/45" />
            </RDialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-3 sm:p-5">
              <RDialog.Content asChild forceMount onPointerDownOutside={(e) => e.preventDefault()}>
                <motion.div
                  key={doc}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16 } }}
                  transition={SPRING}
                  className="pointer-events-auto flex h-[min(88dvh,900px)] w-full max-w-[820px] flex-col overflow-hidden rounded-[28px] bg-white shadow-sheet"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-6 sm:px-7">
                    <div>
                      <p className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">{doc === "terms" ? "Step 2 of 2" : "Step 1 of 2"}</p>
                      <RDialog.Title className="mt-1 text-[22px] font-semibold sm:text-[26px]">{d.title}</RDialog.Title>
                      <RDialog.Description className="sr-only">Read to the end, then sign.</RDialog.Description>
                    </div>
                    <RDialog.Close aria-label="Close" disabled={busy} className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-gray hover:text-navy">
                      <CloseIcon size={18} />
                    </RDialog.Close>
                  </div>
                  <div
                    ref={body}
                    tabIndex={0}
                    aria-label={d.title}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      if (!readToEnd && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadToEnd(true);
                    }}
                    className="flex-1 overflow-auto px-5 py-[22px] text-[16px] leading-[1.6] text-[#2b4456] focus-visible:outline-none sm:px-7"
                  >
                    {d.status && <span className="mb-2.5 inline-block rounded-tag bg-[#FFF4EF] px-2 py-[3px] text-caption font-bold uppercase tracking-[0.06em] text-orange">{d.status}</span>}
                    {d.blocks.map((b, i) =>
                      b.kind === "h" ? (
                        <h4 key={i} className="mb-1.5 mt-[22px] text-[17px] font-semibold text-navy">
                          {b.text}
                        </h4>
                      ) : (
                        <p key={i} className="mb-2.5 max-w-[640px]">
                          {b.text}
                        </p>
                      ),
                    )}
                    <p className="mb-2 mt-7 border-t border-line pt-3.5 text-caption font-semibold uppercase tracking-[0.08em] text-muted">End of document</p>
                  </div>
                  <div className="grid gap-2.5 border-t border-line bg-gray px-5 pb-[22px] pt-4 sm:px-7">
                    <p aria-live="polite" className={cn("text-[13px] font-semibold", ok ? "text-ok" : "text-orange")}>
                      {hint}
                    </p>
                    <div className={cn("grid gap-2.5 transition-opacity sm:grid-cols-2", !readToEnd && "opacity-45")}>
                      <input
                        aria-label="Legal company name"
                        value={company}
                        onChange={(e) => setWho("company", e.target.value)}
                        placeholder="Legal company name"
                        disabled={!readToEnd}
                        className="w-full rounded-input bg-white px-4 py-[13px] shadow-[inset_0_0_0_1px_var(--color-line)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-navy),var(--shadow-ring)] disabled:cursor-not-allowed"
                      />
                      <input
                        aria-label="Your full name and role"
                        value={name}
                        onChange={(e) => setWho("name", e.target.value)}
                        placeholder="Your full name and role"
                        disabled={!readToEnd}
                        className="w-full rounded-input bg-white px-4 py-[13px] shadow-[inset_0_0_0_1px_var(--color-line)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-navy),var(--shadow-ring)] disabled:cursor-not-allowed"
                      />
                    </div>
                    <Tick checked={ticked} onChange={setTicked} disabled={!readToEnd}>
                      {d.agree}
                    </Tick>
                    <div className="flex justify-end">
                      <Button variant="secondary" className="!bg-navy !text-white hover:!bg-hover disabled:!bg-mist" disabled={!ok} state={busy ? "loading" : "idle"} onClick={sign}>
                        {name.trim() ? `Sign as ${name.trim()}` : "Sign"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </RDialog.Content>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
