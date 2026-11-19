"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { fadeUp } from "@/lib/motion";
import { SEC } from "@/questionnaire/schema";
import {
  clientName,
  demoFill,
  exportAnswers,
  exportQuestions,
  importAnswers,
  isAgency,
  makeCtx,
  missingForSend,
  removeClient,
  reviewSummary,
  secStatus,
  setRole,
  steps,
  text,
  totals,
  visible,
  type Mode,
} from "@/questionnaire/logic";
import { sendOwnNda } from "@/app/actions/questionnaire";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useQ } from "./context";
import { QuestionView, Tick } from "./Questions";
import { LegalModal } from "./LegalModal";

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

const fadeIn = { initial: { opacity: 0, y: 6, filter: "blur(3px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } };

export function SecHead({ kicker, title, lead, tags }: { kicker: string; title: string; lead: ReactNode; tags?: ReactNode }) {
  return (
    <motion.div {...fadeIn} className="hero-gradient mb-5 rounded-card px-[22px] pb-7 pt-7 text-white sm:px-10 sm:pb-8 sm:pt-9">
      <p className="text-caption font-semibold uppercase tracking-[0.08em] opacity-85">{kicker}</p>
      <h1 className="mb-1.5 mt-2 text-[30px] font-semibold leading-[1.05] tracking-[-0.01em] sm:text-[40px]">{title}</h1>
      <div className="max-w-[640px] text-[17px] opacity-90">{lead}</div>
      {tags && <div className="mt-[18px] flex flex-wrap gap-2">{tags}</div>}
    </motion.div>
  );
}

export function HeadTag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-tag bg-white/15 px-2 py-1 text-caption font-semibold uppercase tracking-[0.04em]">{children}</span>;
}

export function Card({ children, white, className }: { children: ReactNode; white?: boolean; className?: string }) {
  return (
    <div className={cn("mb-5 rounded-[24px] px-[18px] py-[22px] sm:rounded-card sm:px-9 sm:py-8", white ? "bg-white shadow-[inset_0_0_0_1px_var(--color-line)]" : "bg-gray", className)}>{children}</div>
  );
}

function Foot({ step, children }: { step: string; children?: ReactNode }) {
  const Q = useQ();
  const all = steps(Q.store.state);
  const i = all.indexOf(step);
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      {i > 0 ? (
        <Button variant="outline" onClick={() => Q.go(all[i - 1])}>
          ← Back
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2.5">
        {children ?? (
          <>
            <span className="text-[14px] tabular-nums text-muted">
              {i} / {all.length - 1}
            </span>
            {i < all.length - 1 && (
              <Button variant="primary" onClick={() => Q.go(all[i + 1])}>
                Next
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function SectionPage({ step, sec, cid }: { step: string; sec: string; cid: string | null }) {
  const Q = useQ();
  const s = Q.store.state;
  const d = SEC[sec];
  const c = makeCtx(s, cid);
  const qs = d.qs.filter((q) => visible(s, cid, q));
  const main = qs.filter((q) => !q.more);
  const more = qs.filter((q) => q.more);
  const st = secStatus(s, sec, cid);
  const [moreOpen, setMoreOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const brief = useRef<HTMLInputElement>(null);
  const hasBrief = Q.files.some((f) => f.scope === cid && f.category === "Briefs");
  const moreAnswered = more.some((q) => s.a[cid ? `${cid}:${q.id}` : q.id] !== undefined);

  return (
    <>
      <SecHead
        kicker={`${isAgency(s) && cid ? clientName(s, cid) + " · " : ""}${d.k}`}
        title={text(d.title, c)}
        lead={text(d.lead, c)}
        tags={
          <>
            {st.req > 0 && (
              <HeadTag>
                {st.done} of {st.req} answered
              </HeadTag>
            )}
            {s.mode === "call" && <HeadTag>Pre-filled from our call</HeadTag>}
          </>
        }
      />

      {isAgency(s) && cid && sec === "company" && !Q.readOnly && (
        <Card white>
          <h3 className="text-[19px] font-[530]">Got a brief for this client?</h3>
          <p className="mt-1 text-[14px] text-muted">Drop it here. We&apos;ll fill in what we can and mark it for you to check.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" className="!bg-navy !text-white hover:!bg-hover" onClick={() => brief.current?.click()}>
              Upload the client brief
            </Button>
            <input
              ref={brief}
              type="file"
              hidden
              onChange={(e) => {
                if (e.target.files?.length) Q.uploads.add(e.target.files, cid, true);
                e.target.value = "";
              }}
            />
            {hasBrief && <span className="rounded-tag bg-[#E4ECF2] px-2 py-[3px] text-caption font-semibold">Brief added · we&apos;ll pre-fill this client</span>}
          </div>
          {s.clients.length > 1 && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => setRemoveOpen(true)}>
                Remove this client
              </Button>
              <Dialog
                open={removeOpen}
                onOpenChange={setRemoveOpen}
                size="sm"
                title="Remove this client?"
                description="Their answers and files will be deleted."
                footer={
                  <>
                    <Button variant="ghost" onClick={() => setRemoveOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        for (const f of Q.files.filter((f) => f.scope === cid)) Q.uploads.remove(f.id);
                        const next = s.clients.find((x) => x.id !== cid)!.id;
                        Q.store.edit((st) => removeClient(st, cid));
                        setRemoveOpen(false);
                        Q.go(`${next}|company`);
                      }}
                    >
                      Remove
                    </Button>
                  </>
                }
              />
            </div>
          )}
        </Card>
      )}

      {sec === "people" && !c.get("c_buyers") && (
        <Card white>
          <h3 className="text-[19px] font-[530]">A few questions depend on who buys from you</h3>
          <p className="mt-1 text-[14px] text-muted">Answer “Who buys from you?” and we&apos;ll show the right questions here.</p>
          <div className="mt-3">
            <Button size="sm" className="!bg-navy !text-white hover:!bg-hover" onClick={() => Q.go(cid ? `${cid}|company` : "company")}>
              Answer it now
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {main.map((q) => (
          <QuestionView key={q.id} q={q} />
        ))}
        {more.length > 0 && (!Q.readOnly || moreAnswered) && (
          <details className="group mt-2" open={moreOpen || (Q.readOnly && moreAnswered)} onToggle={(e) => setMoreOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[15px] font-semibold shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-ice [&::-webkit-details-marker]:hidden">
              Add more detail <span className="text-[14px] font-normal text-muted">optional</span>
              <span className="text-[18px] leading-none group-open:hidden">+</span>
              <span className="hidden text-[18px] leading-none group-open:inline">−</span>
            </summary>
            <div className="mt-2">
              {more.map((q) => (
                <QuestionView key={q.id} q={q} />
              ))}
            </div>
          </details>
        )}
      </Card>
      <Foot step={step} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Welcome                                                             */
/* ------------------------------------------------------------------ */

function Opt({ selected, onClick, icon, title, body, tag, disabled }: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; body: string; tag: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 rounded-tile border-2 bg-white px-[22px] pb-5 pt-[22px] text-left transition-[border-color,transform] duration-200 enabled:hover:-translate-y-0.5",
        selected ? "border-navy" : "border-transparent",
        disabled && !selected && "opacity-60",
      )}
    >
      <span className={cn("mb-2 grid size-11 place-items-center rounded-[14px] text-[20px] transition-colors", selected ? "bg-navy text-white" : "bg-gray")}>{icon}</span>
      <b className="text-[19px] font-semibold">{title}</b>
      <span className="text-[14px] text-muted">{body}</span>
      <span className="mt-auto pt-2 text-caption font-semibold uppercase tracking-[0.06em] text-muted">{tag}</span>
    </button>
  );
}

const svg = (d: ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export function WelcomePage() {
  const Q = useQ();
  const s = Q.store.state;
  const ai = useRef<HTMLInputElement>(null);
  const lock = Q.readOnly || !Q.canEdit("role");

  async function copy(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      Q.toast("Copied", "ok");
    } catch {
      Q.toast("Select and copy manually");
    }
  }

  return (
    <>
      <motion.div {...fadeIn} className="hero-gradient mb-5 rounded-card px-[22px] py-7 text-white sm:px-12 sm:py-14">
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] opacity-90">Toggle Concepts · Brand questionnaire</p>
        <h1 className="mb-3.5 mt-3 max-w-[760px] text-[36px] font-semibold leading-[1.02] tracking-[-0.015em] sm:text-[52px]">Help us get to know your brand.</h1>
        <p className="max-w-[620px] text-[18px] opacity-90">Your answers shape every idea, line and picture we make. The more we know, the fewer guesses in month one.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <HeadTag>Mostly tap, little typing</HeadTag>
          <HeadTag>Saves as you go</HeadTag>
          <HeadTag>Covered by NDA</HeadTag>
        </div>
      </motion.div>

      <Card>
        <h3 className="text-[19px] font-[530]">Who&apos;s filling this in?</h3>
        <div role="radiogroup" aria-label="Who's filling this in?" className="mt-4 grid gap-3 md:grid-cols-2">
          <Opt
            selected={s.role === "brand"}
            disabled={lock}
            onClick={() => Q.store.edit((st) => setRole(st, "brand"))}
            icon={svg(<circle cx="12" cy="12" r="8" />)}
            title="A brand"
            body="We advertise our own product or service."
            tag="Your own brand"
          />
          <Opt
            selected={s.role === "agency"}
            disabled={lock}
            onClick={() => Q.store.edit((st) => setRole(st, "agency"))}
            icon={svg(<><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></>)}
            title="An agency"
            body="We work for clients. White label, under NDA. Set up your agency once, then add each client."
            tag="For your clients"
          />
        </div>
        <TeamNote>
          Выбор роли перестраивает анкету. Агентство: свой блок «Your agency» + отдельный профиль на каждого клиента с проф. настройками (оси вариаций, спеки, имена файлов, строгость гайда). Ответы обеих веток сохраняются, переключаться можно без потерь.
        </TeamNote>
      </Card>

      {s.role && (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card>
            <h3 className="text-[19px] font-[530]">How would you like to do this?</h3>
            <div role="radiogroup" aria-label="How would you like to do this?" className="mt-4 grid gap-3 md:grid-cols-3">
              {(
                [
                  ["self", svg(<path d="M4 20h4L19 9l-4-4L4 16v4z" />), "Fill it in now", "Then a short call to go over the gaps.", "Before the call"],
                  ["call", svg(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />), "We already talked", "We filled in what we heard. Check it, add the rest, take the quick “This or that”.", "After the call"],
                  ["ai", svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />), "With your AI assistant", "Copy the questions into ChatGPT or Claude with your materials, then upload the answers here.", "Before or after the call"],
                ] as [Mode, ReactNode, string, string, string][]
              ).map(([m, icon, title, body, tag]) => (
                <Opt key={m} selected={s.mode === m} disabled={lock} onClick={() => Q.store.edit((st) => ({ ...st, mode: m }))} icon={icon} title={title} body={body} tag={tag} />
              ))}
            </div>
            {s.mode === "ai" && !Q.readOnly && (
              <motion.div {...fadeIn} className="mt-3 rounded-tile bg-white p-[22px]">
                <b>How it works</b>
                <ol className="mb-3.5 mt-2 list-decimal pl-5 [&>li]:my-1">
                  <li>Copy the questions below.</li>
                  <li>Paste them into ChatGPT or Claude, along with your website, brand book or deck.</li>
                  <li>Read the answers, fix anything that&apos;s off, save them as a .md or .txt file.</li>
                  <li>Upload the file here. We&apos;ll fill in the form and mark those answers for you to check.</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="!bg-navy !text-white hover:!bg-hover" onClick={() => copy(exportQuestions(s))}>
                    Copy the questions
                  </Button>
                  <Button size="sm" onClick={() => ai.current?.click()}>
                    Upload answers
                  </Button>
                  <input
                    ref={ai}
                    type="file"
                    accept=".md,.txt,.markdown"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      const txt = await f.text();
                      let n = 0;
                      Q.store.edit((st) => {
                        const r = importAnswers(st, txt);
                        n = r.count;
                        return r.state;
                      });
                      Q.toast(n ? `${n} answers filled in — please check them` : "Couldn't read answers from this file", n ? "ok" : "err");
                      if (n) Q.go(isAgency(s) ? "agency" : "company");
                    }}
                  />
                </div>
                <p className="mt-3 text-[14px] text-muted">“This or that”, files and NDA are done here by hand. That part only works with a human gut feeling.</p>
              </motion.div>
            )}
            {s.mode === "call" && (
              <TeamNote>
                Режим «после созвона»: арт-директор/менеджер заранее заполняет анкету по итогам созвона, клиент видит метки «From our call · check». Кнопка ниже — демо такого предзаполнения.{" "}
                {!Q.readOnly && (
                  <button
                    type="button"
                    className="ml-1.5 rounded-full bg-gray px-3 py-1 text-small font-medium"
                    onClick={() => {
                      Q.store.edit((st) => demoFill(st));
                      Q.toast("Demo answers added with “From our call” marks", "ok");
                      Q.go(isAgency(s) ? `${s.clients[0].id}|company` : "company");
                    }}
                  >
                    Load demo pre-fill
                  </button>
                )}
              </TeamNote>
            )}
            <TeamNote>
              Три пути: анкета → созвон; созвон → анкета; письменно/через AI → анкета. В любом случае клиент проходит здесь «This or that», загрузку файлов и NDA. Оплата в анкету не входит.
            </TeamNote>
          </Card>
        </motion.div>
      )}

      {s.role && s.mode && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[14px] text-muted">{Q.readOnly ? "" : "You can stop anytime. Your answers stay here."}</span>
          <Button variant="primary" onClick={() => Q.go(steps(s)[1])}>
            {Q.readOnly ? "Next" : "Let's start"}
          </Button>
        </div>
      )}
    </>
  );
}

export function TeamNote({ children }: { children: ReactNode }) {
  const Q = useQ();
  if (!Q.teamNotes) return null;
  return (
    <div className="mt-2.5 rounded-tag border-l-[3px] border-orange bg-[#FFF4EF] px-3 py-2 text-[13px] text-[#5b3a2c]">
      <b className="text-orange">Для команды:</b> {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* NDA & terms                                                         */
/* ------------------------------------------------------------------ */

const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export function LegalPage({ step }: { step: string }) {
  const Q = useQ();
  const l = Q.store.state.legal;
  const [doc, setDoc] = useState<"nda" | "terms" | null>(null);
  const ndaDone = Boolean(l.nda || l.ndaOwn);
  const allSigned = ndaDone && Boolean(l.terms);
  const editable = !Q.readOnly && Q.view.status === "draft";

  return (
    <>
      <SecHead kicker="Finish" title="NDA & terms" lead="Two documents, one after the other. Read to the end, then sign." />
      <Card>
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h3 className="text-[19px] font-[530]">Documents</h3>
          {editable && <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Required</span>}
        </div>
        <div className="mt-3.5 grid gap-2">
          <SigRow
            label="1 · Mutual NDA"
            done={ndaDone}
            detail={l.ndaOwn ? "You'll send your own NDA. We'll sign it before we start." : l.nda ? `Signed by ${l.nda.by} · ${fmtWhen(l.nda.at)}` : "Not signed yet"}
          />
          <SigRow label="2 · Terms & usage rights" done={Boolean(l.terms)} detail={l.terms ? `Signed by ${l.terms.by} · ${fmtWhen(l.terms.at)}` : "Not signed yet"} />
        </div>
        {editable && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setDoc(ndaDone && !l.terms ? "terms" : "nda")}>
              {allSigned ? "Read again" : ndaDone ? "Read and sign the terms" : "Read and sign"}
            </Button>
            {!ndaDone && (
              <SendOwnNda />
            )}
          </div>
        )}
        <div className="mt-5 border-t border-line pt-4">
          {editable ? (
            <Tick checked={Boolean(l.caseStudy)} onChange={(v) => Q.store.edit((st) => ({ ...st, legal: { ...st.legal, caseStudy: v } }))}>
              {isAgency(Q.store.state) ? "You may show anonymized work as a case study (optional)" : "You may show our work as a case study (optional)"}
            </Tick>
          ) : (
            <p className="text-[15px] text-muted">{l.caseStudy ? "You allowed us to show the work as a case study." : "Case study: not allowed."}</p>
          )}
          <TeamNote>
            NDA и условия идут подряд в одном большом окне, открывается без ввода имени. Поля компании и подписанта, галочка и кнопка «Sign» активируются только после прокрутки до конца документа. После NDA окно сразу переходит к условиям. Подпись = имя подписанта + дата (в боевой версии — e-sign или PDF с подписью). Тексты — заглушки для юриста. Оплаты здесь нет.
          </TeamNote>
        </div>
      </Card>
      <Foot step={step} />
      <LegalModal doc={doc} onDoc={setDoc} />
    </>
  );
}

function SigRow({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-white px-[18px] py-3.5">
      <div>
        <b>{label}</b>
        <p className="mt-0.5 text-[14px] text-muted">{detail}</p>
      </div>
      {done && <span className="text-[13px] font-semibold text-ok">✓ Done</span>}
    </div>
  );
}

function SendOwnNda() {
  const Q = useQ();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      state={busy ? "loading" : "idle"}
      onClick={async () => {
        setBusy(true);
        await Q.store.flush();
        const r = await sendOwnNda(Q.view.id);
        setBusy(false);
        if (r.ok) {
          Q.store.receive(r.data);
          Q.toast("Send your NDA to hello@toggle.studio or drop it in Files");
        } else Q.toast(r.error, "err");
      }}
    >
      We&apos;ll send our own NDA
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Check & send                                                        */
/* ------------------------------------------------------------------ */

export function ReviewPage({ step, onSend, sending }: { step: string; onSend: () => void; sending: boolean }) {
  const Q = useQ();
  const s = Q.store.state;
  const { items, decide, unsure } = reviewSummary(s);
  const t = totals(s);
  const missing = missingForSend(s);
  const ready = missing.length === 0;
  const status = Q.view.status;
  const resending = status === "changes_requested";
  const [confirm, setConfirm] = useState(false);
  const missingAnswers = missing.filter((m) => m.key !== "legal").length;
  const needsLegal = missing.some((m) => m.key === "legal");

  const explain = [missingAnswers ? `${missingAnswers} answer${missingAnswers === 1 ? "" : "s"} to finish` : null, needsLegal ? "the NDA and terms to sign" : null]
    .filter(Boolean)
    .join(", and ");

  async function copyAnswers() {
    try {
      await navigator.clipboard.writeText(exportAnswers(s));
      Q.toast("Copied", "ok");
    } catch {
      Q.toast("Select and copy manually");
    }
  }

  const lead =
    status === "submitted"
      ? "Sent. Here's everything you told us."
      : status === "approved"
        ? "Approved. Here's everything you told us."
        : resending
          ? "Check your changes, then send your answers."
          : ready
            ? "All set. Send it over. We'll get back to you soon."
            : "A few things are missing. Finish them and you can send it.";

  return (
    <>
      <SecHead kicker="Finish" title={status === "draft" || resending ? "Check & send" : "Your answers"} lead={lead} tags={<HeadTag>{t.done} of {t.req} required answers</HeadTag>} />
      <Card>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {items.map((it) => (
            <button key={it.step} type="button" onClick={() => Q.go(it.step)} className="rounded-tile-sm bg-white px-[18px] py-4 text-left transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-pop">
              <h5 className="mb-1.5 flex justify-between gap-2 text-[16px] font-semibold">
                {it.title}
                {it.status.req > 0 &&
                  (it.status.done === it.status.req ? (
                    <span className="shrink-0 text-[13px] font-semibold text-ok">Done</span>
                  ) : (
                    <span className="shrink-0 text-[13px] font-semibold text-err">{it.status.req - it.status.done} missing</span>
                  ))}
              </h5>
              {it.status.missing.length > 0 && (
                <ul className="mt-1.5 list-disc pl-[18px] text-[14px] text-muted">
                  {it.status.missing.slice(0, 4).map((m) => (
                    <li key={m.key}>{m.label}</li>
                  ))}
                  {it.status.missing.length > 4 && <li>+{it.status.missing.length - 4} more</li>}
                </ul>
              )}
            </button>
          ))}
        </div>
      </Card>
      {(decide.length > 0 || unsure.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          {decide.length > 0 ? (
            <Card>
              <h3 className="text-[19px] font-[530]">We&apos;ll take it from here</h3>
              <p className="mt-1 text-[14px] text-muted">You picked “Up to you”. Our art director will suggest these.</p>
              <ul className="mt-2 list-disc pl-5 text-[14px] text-muted">
                {decide.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Card>
          ) : (
            <div />
          )}
          {unsure.length > 0 && (
            <Card>
              <h3 className="text-[19px] font-[530]">We&apos;ll ask on the call</h3>
              <ul className="mt-2 list-disc pl-5 text-[14px] text-muted">
                {unsure.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
      <TeamNote>«Up to you» = решает арт-директор. «Not sure / Hard to say» = пробел → список уточнений к созвону (правило коллеги).</TeamNote>
      <Foot step={step}>
        <Button onClick={copyAnswers}>Copy my answers</Button>
        {(status === "draft" || resending) && (
          <div className="flex flex-col items-end gap-1">
            <Button variant="primary" disabled={!ready} state={sending ? "loading" : "idle"} onClick={() => setConfirm(true)} aria-describedby={!ready ? "send-why" : undefined}>
              {resending ? "Send answers" : "Send"}
            </Button>
          </div>
        )}
      </Foot>
      {!ready && (status === "draft" || resending) && (
        <p id="send-why" className="mt-3 text-right text-small text-muted">
          To send: {explain}.{" "}
          <button type="button" className="font-medium text-navy underline underline-offset-4" onClick={() => Q.go(missing[0].step)}>
            Take me there
          </button>
        </p>
      )}
      <Dialog
        open={confirm}
        onOpenChange={(o) => !sending && setConfirm(o)}
        dismissible={!sending}
        size="sm"
        title={resending ? "Send your answers?" : "Send the questionnaire?"}
        description={
          resending
            ? "We'll read them and come back to you. The rest stays locked while we review."
            : "You won't be able to change your answers while we review them. We'll get back to you within a day."
        }
        footer={
          <>
            <Button variant="ghost" disabled={sending} onClick={() => setConfirm(false)}>
              Back
            </Button>
            <Button variant="primary" state={sending ? "loading" : "idle"} onClick={onSend}>
              {resending ? "Send answers" : "Send"}
            </Button>
          </>
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Done                                                                */
/* ------------------------------------------------------------------ */

export function DonePage() {
  const Q = useQ();
  const after = Q.store.state.mode === "call";
  return (
    <>
      <motion.div {...fadeIn} className="hero-gradient mb-5 rounded-card px-[22px] py-7 text-white sm:px-12 sm:py-14">
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] opacity-90">Sent</p>
        <h1 className="mb-3.5 mt-3 max-w-[760px] text-[36px] font-semibold leading-[1.02] tracking-[-0.015em] sm:text-[52px]">Thank you. We&apos;ve got it from here.</h1>
        <p className="max-w-[620px] text-[18px] opacity-90">
          {after ? "Your art director is on the concepts now." : "We'll read everything before the call, so we can spend it on ideas, not questions."}
        </p>
      </motion.div>
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          {(after
            ? [["First", "We craft the concepts. You approve them first."], ["Then", "We build every version."], ["Last", "Experts check every file. Your campaign is ready."]]
            : [["Today", "We read your answers and files."], ["Next", "A call about your goals."], ["Then", "Your first concepts."]]
          ).map(([k, v], i) => (
            <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i + 0.1, duration: 0.32, ease: [0.16, 1, 0.3, 1] }} className="rounded-tile-sm bg-white p-[18px]">
              <b className="mb-1.5 block text-[13px] uppercase tracking-[0.06em] text-muted">{k}</b>
              {v}
            </motion.div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {!after && (
            <Button asChild variant="primary">
              <a href="https://concepts.toggle.studio" target="_blank" rel="noopener noreferrer">
                Book the call
              </a>
            </Button>
          )}
          <Button onClick={() => Q.go("review")}>Back to my answers</Button>
        </div>
        <TeamNote>Здесь в боевой версии — ссылка на календарь (Cal.com / Calendly). Ответы уходят в базу знаний бренда.</TeamNote>
      </Card>
    </>
  );
}
