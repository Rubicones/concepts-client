"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { BRAND_GROUPS, CLIENT_SECS, SEC } from "@/questionnaire/schema";
import { addClient, clientName, isAgency, parseStep, secStatus, sectionTitle, steps, stepSlug, totals } from "@/questionnaire/logic";
import { Dialog } from "@/components/ui/Dialog";
import { Chip } from "@/components/ui/Chip";
import { useQ } from "./context";

/**
 * Progress and sections (prototype sidebar): % done, a dot per section
 * (empty / half / done; the current one ringed in orange), agency clients,
 * and "Send a part to a colleague". Sections with our questions show an orange count.
 */
export function Sidebar({ step, onNavigate }: { step: string; onNavigate?: () => void }) {
  const Q = useQ();
  const s = Q.store.state;
  const t = totals(s);
  const pct = t.req ? Math.round((t.done / t.req) * 100) : 0;
  const active = parseStep(step).cid ?? s.clients[0]?.id;
  const go = (st: string) => {
    Q.go(st);
    onNavigate?.();
  };

  /** Open follow-up questions per step, while "Questions for you". */
  const questionsIn = (st: string) => {
    const p = parseStep(st);
    const prefix = p.cid ? `${p.cid}:` : "";
    return Q.view.notes.filter(
      (n) =>
        n.authorRole === "studio" &&
        !n.resolvedAt &&
        n.questionIds.some((id) => {
          if (prefix ? !id.startsWith(prefix) : id.includes(":")) return false;
          const base = id.slice(prefix.length);
          return Boolean(base) && (p.sec === "legal" ? false : sectionOf(base) === p.sec);
        }),
    ).length;
  };

  const item = (st: string, label: string) => (
    <SideItem key={st} st={st} label={label} current={step === st} onGo={go} questions={Q.view.status === "changes_requested" ? questionsIn(st) : 0} />
  );

  return (
    <nav aria-label="Questionnaire sections">
      <div className="mx-2 mb-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#dfe5ea]" role="progressbar" aria-label="Questionnaire progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <b className="block h-full rounded-full bg-navy transition-[width] duration-[400ms] ease-out" style={{ width: `${pct}%` }} />
        </div>
        <small className="mt-1.5 block text-caption tabular-nums text-muted">{pct}% done</small>
      </div>

      {!isAgency(s) ? (
        <>
          <H>{s.role ? "Brand" : "Questionnaire"}</H>
          <ul className="mb-3.5">
            {item("welcome", "Start")}
            {s.role && BRAND_GROUPS[0].secs.map((sec) => item(sec, sectionTitle(s, sec, null)))}
          </ul>
          {s.role && (
            <>
              <H>The creative part</H>
              <ul className="mb-3.5">
                {BRAND_GROUPS[1].secs.map((sec) =>
                  item(sec, sectionTitle(s, sec, null)),
                )}
              </ul>
              <H>Finish</H>
              <ul className="mb-3.5">
                {item("legal", "NDA & terms")}
                {item("review", "Check & send")}
              </ul>
            </>
          )}
        </>
      ) : (
        <>
          <H>Agency</H>
          <ul className="mb-3.5">
            {item("welcome", "Start")}
            {item("agency", "Your agency")}
          </ul>
          <H>Your clients</H>
          <div className="mx-1.5 mb-2.5 flex flex-wrap gap-1.5">
            {s.clients.map((c) => (
              <Chip key={c.id} size="sm" noCheck selected={active === c.id} onSelectedChange={() => go(`${c.id}|company`)}>
                {clientName(s, c.id)}
              </Chip>
            ))}
            {!Q.readOnly && Q.canEdit("clients") && (
              <button
                type="button"
                onClick={() => {
                  let id = "";
                  Q.store.edit((st) => {
                    const r = addClient(st);
                    id = r.id;
                    return r.state;
                  });
                  if (id) go(`${id}|company`);
                }}
                className="h-8 rounded-full px-3 text-small font-medium shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-white"
              >
                + Add client
              </button>
            )}
          </div>
          <ul className="mb-3.5 pl-3.5">
            {active &&
              CLIENT_SECS.map((sec) =>
                item(`${active}|${sec}`, sectionTitle(s, sec, active)),
              )}
          </ul>
          <H>Finish</H>
          <ul className="mb-3.5">
            {item("legal", "NDA & terms")}
            {item("review", "Check & send")}
          </ul>
        </>
      )}

      {s.role && Q.view.status === "draft" && <ShareButton />}
    </nav>
  );
}

/** Question id → its section. */
const SECTION_OF = new Map(Object.entries(SEC).flatMap(([sec, d]) => d.qs.map((q) => [q.id, sec] as const)));
const sectionOf = (qid: string) => SECTION_OF.get(qid);

function H({ children }: { children: string }) {
  return <h4 className="mx-2 mb-2.5 mt-1 text-caption font-semibold uppercase tracking-[0.08em] text-muted">{children}</h4>;
}

function SideItem({ st, label, current, onGo, questions }: { st: string; label: string; current: boolean; onGo: (st: string) => void; questions: number }) {
  const Q = useQ();
  const p = parseStep(st);
  const r = secStatus(Q.store.state, p.sec, p.cid);
  const state = r.req === 0 ? "" : r.done === r.req ? "done" : r.done > 0 ? "part" : "";
  return (
    <li>
      <button
        type="button"
        aria-current={current ? "step" : undefined}
        onClick={() => onGo(st)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[14px] px-2.5 py-[9px] text-left text-[15px] transition-colors",
          current ? "bg-white font-semibold" : "hover:bg-gray-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-2.5 shrink-0 rounded-full border-[1.5px] transition-colors",
            state === "done" && "border-navy bg-navy",
            state === "part" && "border-navy bg-[linear-gradient(90deg,var(--color-navy)_50%,transparent_50%)]",
            !state && "border-mist",
            current && "border-orange",
          )}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {questions > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-orange px-1.5 text-caption font-semibold tabular-nums text-white" aria-label={`${questions} question${questions === 1 ? "" : "s"} for you`}>
            {questions}
          </span>
        )}
        {state === "done" && <span className="sr-only">(done)</span>}
      </button>
    </li>
  );
}

function ShareButton() {
  const Q = useQ();
  const s = Q.store.state;
  const [open, setOpen] = useState(false);
  const parts = steps(s).filter((st) => !["welcome", "review"].includes(parseStep(st).sec));
  return (
    <>
      <h4 className="mx-2 mb-2.5 mt-1 text-caption font-semibold uppercase tracking-[0.08em] text-muted">Share</h4>
      <div className="mx-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-8 rounded-full px-3 text-small font-medium shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-white"
        >
          Send a part to a colleague
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen} title="Send a part to a colleague" description="Pick the part a colleague knows best, like sales or marketing. They get a link to just that part.">
        <div className="flex flex-wrap gap-2">
          {parts.map((st) => {
            const p = parseStep(st);
            return (
              <Chip
                key={st}
                noCheck
                onSelectedChange={async () => {
                  const url = `${window.location.origin}/questionnaire/${stepSlug(st)}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    Q.toast("Link copied", "ok");
                  } catch {
                    Q.toast(url);
                  }
                  setOpen(false);
                }}
              >
                {(p.cid ? clientName(s, p.cid) + " · " : "") + sectionTitle(s, p.sec, p.cid)}
              </Chip>
            );
          })}
        </div>
        {Q.teamNotes && (
          <div className="rounded-tag border-l-[3px] border-orange bg-[#FFF4EF] px-3 py-2 text-[13px] text-[#5b3a2c]">
            <b className="text-orange">Для команды:</b> Ссылка ведёт на раздел этой же анкеты. С входом по ссылке (позже) коллега попадёт в ту же анкету своего аккаунта.
          </div>
        )}
      </Dialog>
    </>
  );
}
