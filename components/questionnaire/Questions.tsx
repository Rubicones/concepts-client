"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING, feedback } from "@/lib/motion";
import { DECIDE, MOOD, PAIRS, questionById, type Question } from "@/questionnaire/schema";
import {
  addRow,
  applySameAs,
  deleteRow,
  makeCtx,
  pickChip,
  scopedKey,
  setAnswer,
  setPair,
  setRowField,
  text,
  toggleMood,
  toggleMoodDecide,
  toggleNot,
  toggleStar,
  toggleWorld,
} from "@/questionnaire/logic";
import { Chip } from "@/components/ui/Chip";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { useQ } from "./context";
import { FilesQuestion } from "./Files";

/**
 * One renderer per prototype question type, editable or read-only.
 * Read-only answers read like a finished document, not a disabled form.
 */

type Row = { a?: string; b?: string; s?: boolean };

const inputClass =
  "w-full rounded-input bg-white px-4 py-[13px] text-[16px] text-navy placeholder:text-[#93a1ab] shadow-[inset_0_0_0_1px_var(--color-line)] transition-[box-shadow] duration-150 hover:shadow-[inset_0_0_0_1px_var(--color-mist)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-navy),var(--shadow-ring)]";

export function QuestionView({ q }: { q: Question }) {
  const Q = useQ();
  const c = makeCtx(Q.store.state, Q.scope);
  const key = scopedKey(Q.scope, q.id);
  const editable = !Q.readOnly && Q.canEdit(key);
  const flag = Q.store.state.flags[key];
  const label = text(q.label, c);
  const notes = Q.notesFor(key);

  if (q.type === "files") return <FilesQuestion q={q} editable={editable} />;

  if (q.type === "tick") {
    const on = Boolean(c.get(q.id));
    return (
      <Shell id={q.id} q={q}>
        {editable ? <Tick checked={on} onChange={(v) => Q.store.edit((s) => setAnswer(s, Q.scope, q.id, v))}>{label}</Tick> : <ReadTick on={on}>{label}</ReadTick>}
        {on && <BrandingAddon />}
      </Shell>
    );
  }

  return (
    <Shell id={q.id} q={q}>
      {label && (
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="text-[19px] font-[530] leading-[1.3]">{label}</h3>
          {q.req && editable && <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Required</span>}
          {flag && (
            <span className={cn("inline-flex items-center rounded-tag px-2 py-[3px] text-caption font-semibold", flag === "file" ? "bg-[#E4ECF2]" : "bg-sky")}>
              {flag === "file" ? "From your file · check" : "From our call · check"}
            </span>
          )}
          {notes.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-tag bg-orange-soft px-2 py-[3px] text-caption font-semibold text-navy">
              <span className="size-1.5 rounded-full bg-orange" aria-hidden="true" />
              Question for you
            </span>
          )}
        </div>
      )}
      {q.hint && editable && <p className="mt-1 text-[14px] text-muted">{text(q.hint, c)}</p>}
      {notes.map((n) => (
        <StudioNote key={n.id} noteId={n.id} body={n.body} />
      ))}
      <div className="mt-3.5">{editable ? <Edit q={q} /> : <Read q={q} />}</div>
    </Shell>
  );
}

function Shell({ id, q, children }: { id: string; q: Question; children: ReactNode }) {
  const Q = useQ();
  return (
    <div id={`q-${id}`} className="scroll-mt-28 border-t border-line py-[22px] first:border-t-0 first:pt-0 last:pb-0">
      {children}
      {Q.teamNotes && q.n && (
        <div className="mt-2.5 rounded-tag border-l-[3px] border-orange bg-[#FFF4EF] px-3 py-2 text-[13px] text-[#5b3a2c]">
          <b className="text-orange">Для команды:</b> {q.n}
        </div>
      )}
    </div>
  );
}

/** Our follow-up question, attached to the exact answer, with the client's reply. */
function StudioNote({ noteId, body }: { noteId: string; body: string }) {
  const Q = useQ();
  const id = useId();
  return (
    <div className="mt-3 rounded-tile-sm bg-white p-4 shadow-[inset_3px_0_0_var(--color-orange)]">
      <p className="kicker !text-orange">Our question</p>
      <p className="mt-1 text-body">{body}</p>
      {!Q.readOnly && (
        <>
          <label htmlFor={id} className="mt-3 block text-small font-medium">
            Your reply <span className="font-normal text-muted">(optional if you changed the answer)</span>
          </label>
          <textarea
            id={id}
            value={Q.replyFor(noteId)}
            onChange={(e) => Q.setReply(noteId, e.target.value)}
            placeholder="A line or two"
            className={cn(inputClass, "mt-1.5 min-h-[72px] resize-none [field-sizing:content]")}
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editable                                                            */
/* ------------------------------------------------------------------ */

function Edit({ q }: { q: Question }) {
  const Q = useQ();
  const s = Q.store.state;
  const c = makeCtx(s, Q.scope);
  const set = (id: string, v: unknown) => Q.store.edit((st) => setAnswer(st, Q.scope, id, v));
  const report = (err: string | undefined) => err && Q.toast(err);

  switch (q.type) {
    case "text": {
      const partner = q.half ? questionById(q.half) : undefined;
      if (partner) {
        return (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TextInput value={c.get(q.id)} onChange={(v) => set(q.id, v)} placeholder={text(q.ph, c)} label={text(q.label, c)} />
            <TextInput
              value={c.get(partner.id)}
              onChange={(v) => set(partner.id, v)}
              placeholder={text(partner.label, c) + (partner.ph ? ": " + text(partner.ph, c) : "")}
              label={text(partner.label, c)}
            />
          </div>
        );
      }
      return <TextInput value={c.get(q.id)} onChange={(v) => set(q.id, v)} placeholder={text(q.ph, c)} label={text(q.label, c)} />;
    }
    case "short":
      return (
        <textarea
          aria-label={text(q.label, c)}
          value={String(c.get(q.id) ?? "")}
          onChange={(e) => set(q.id, e.target.value)}
          placeholder={text(q.ph, c)}
          className={cn(inputClass, "min-h-[84px] resize-none [field-sizing:content] max-h-[22lh]")}
        />
      );
    case "chips": {
      const opts = (q.optsFrom ? (c.arr(q.optsFrom) as string[]).filter((x) => x !== DECIDE) : (q.opts ?? []).slice()).concat(q.decide ? [DECIDE] : []);
      const sel = q.multi ? (c.arr(q.id) as string[]) : [c.get(q.id) as string];
      const atMax = Boolean(q.max && sel.length >= q.max);
      const all = q.other ? [...opts, "Other"] : opts;
      return (
        <>
          <div role="group" aria-label={text(q.label, c)} className="flex flex-wrap gap-2">
            {all.map((o) => (
              <Chip
                key={o}
                selected={sel.includes(o)}
                decide={o === DECIDE}
                dim={atMax}
                noCheck={!q.multi}
                onSelectedChange={() => report(Q.store.edit((st) => pickChip(st, Q.scope, q, o)))}
              >
                {o}
              </Chip>
            ))}
          </div>
          {q.other && sel.includes("Other") && (
            <TextInput className="mt-2" value={c.get(q.id + "__other")} onChange={(v) => set(q.id + "__other", v)} placeholder="Tell us in a few words" label="Other" autoFocus />
          )}
          {q.max && (
            <p className="mt-2 text-[13px] tabular-nums text-muted">
              {sel.filter((x) => x !== DECIDE).length} of {q.max}
            </p>
          )}
        </>
      );
    }
    case "pick":
      return <PickEdit q={q} />;
    case "rows":
    case "links":
      return <RowsEdit q={q} />;
    case "months": {
      const sel = c.arr(q.id) as string[];
      return (
        <div role="group" aria-label={text(q.label, c)} className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => (
            <Chip key={m} noCheck selected={sel.includes(m)} className="justify-center !px-0" onSelectedChange={() => report(Q.store.edit((st) => pickChip(st, Q.scope, q, m)))}>
              {m}
            </Chip>
          ))}
        </div>
      );
    }
    case "pairs":
      return <PairsEdit />;
    case "mood":
      return <MoodEdit />;
    case "notyou": {
      const not = c.get(q.id) as string | undefined;
      const picked = c.arr("v_mood") as string[];
      return (
        <div role="group" aria-label={text(q.label, c)} className="flex flex-wrap gap-2">
          {MOOD.filter((m) => !picked.includes(m[0])).map(([mk, cap]) => (
            <Chip key={mk} noCheck selected={not === mk} onSelectedChange={() => Q.store.edit((st) => toggleNot(st, Q.scope, mk))}>
              {cap}
            </Chip>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

function TextInput({
  value,
  onChange,
  placeholder,
  label,
  className,
  autoFocus,
}: {
  value: unknown;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      aria-label={label}
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={cn(inputClass, className)}
    />
  );
}

function PickEdit({ q }: { q: Question }) {
  const Q = useQ();
  const c = makeCtx(Q.store.state, Q.scope);
  const [query, setQuery] = useState("");
  const sel = c.arr(q.id) as string[];
  const world = Boolean(c.get(q.id + "_world"));
  const sameAs = q.sameAs ? (c.arr(q.sameAs) as string[]) : [];
  const needle = query.trim().toLowerCase();
  const pool = (q.list ?? []).filter((o) => !sel.includes(o) && (!needle || o.toLowerCase().includes(needle))).slice(0, needle ? 40 : 14);
  const pick = (o: string) => Q.store.edit((st) => pickChip(st, Q.scope, q, o));

  return (
    <div>
      {(sameAs.length > 0 || q.world) && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {sameAs.length > 0 && (
            <Chip onSelectedChange={() => Q.store.edit((st) => applySameAs(st, Q.scope, q))} noCheck size="sm" className="!h-9">
              Same as above: {sameAs.join(", ")}
            </Chip>
          )}
          {q.world && (
            <Chip selected={world} onSelectedChange={() => Q.store.edit((st) => toggleWorld(st, Q.scope, q.id))}>
              Worldwide
            </Chip>
          )}
        </div>
      )}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229 && pool[0]) {
            e.preventDefault();
            pick(pool[0]);
            setQuery("");
          }
        }}
        placeholder={text(q.ph, c)}
        aria-label={text(q.label, c)}
        className={cn(inputClass, "mb-2.5")}
      />
      {sel.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {sel.map((o) => (
              <motion.span key={o} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={feedback}>
                <button
                  type="button"
                  onClick={() => pick(o)}
                  aria-label={`Remove ${o}`}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-navy px-4 text-body font-medium text-white transition-[background-color,transform] hover:bg-hover active:scale-[0.98]"
                >
                  {o} <CloseIcon size={13} className="opacity-70" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
      <div className="flex max-h-[170px] flex-wrap gap-2 overflow-auto p-0.5">
        {pool.length ? (
          pool.map((o) => (
            <Chip key={o} noCheck onSelectedChange={() => pick(o)}>
              {o}
            </Chip>
          ))
        ) : (
          <span className="text-[14px] text-muted">Nothing found. Try another spelling.</span>
        )}
      </div>
    </div>
  );
}

function RowsEdit({ q }: { q: Question }) {
  const Q = useQ();
  const c = makeCtx(Q.store.state, Q.scope);
  const v = c.get(q.id);
  const rows: Row[] = Array.isArray(v) && v.length ? (v as Row[]) : [{}];
  const links = q.type === "links";
  const cols = links ? ["https://", "What about it? (optional)"] : q.cols ?? ["", ""];
  const max = links ? 20 : q.max ?? 5;
  const two = links || q.two;
  return (
    <div>
      <AnimatePresence initial={false}>
        {rows.map((r, i) => (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={feedback}
            className={cn("mb-2 grid items-center gap-2", two ? "grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto]" : "grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_1.6fr_auto_auto]")}
          >
            <input
              aria-label={`${text(q.label, c)}: ${cols[0]} ${i + 1}`}
              value={r.a ?? ""}
              onChange={(e) => Q.store.edit((st) => setRowField(st, Q.scope, q.id, i, "a", e.target.value))}
              placeholder={cols[0]}
              className={inputClass}
            />
            <input
              aria-label={`${text(q.label, c)}: ${cols[1]} ${i + 1}`}
              value={r.b ?? ""}
              onChange={(e) => Q.store.edit((st) => setRowField(st, Q.scope, q.id, i, "b", e.target.value))}
              placeholder={cols[1]}
              className={cn(inputClass, "order-3 col-span-full sm:order-none sm:col-span-1")}
            />
            {q.star && (
              <button
                type="button"
                aria-pressed={Boolean(r.s)}
                aria-label="Most important now"
                title="Most important now"
                onClick={() => {
                  const err = Q.store.edit((st) => toggleStar(st, Q.scope, q.id, i));
                  if (err) Q.toast(err);
                }}
                className={cn(
                  "grid size-10 place-items-center rounded-full bg-white text-[18px] transition-[color,box-shadow,transform] active:scale-[0.94]",
                  r.s ? "text-orange shadow-[inset_0_0_0_1px_var(--color-orange)]" : "text-mist shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-muted",
                )}
              >
                ★
              </button>
            )}
            <button
              type="button"
              aria-label="Remove"
              title="Remove"
              onClick={() => Q.store.edit((st) => deleteRow(st, Q.scope, q.id, i))}
              className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-gray-strong"
            >
              <CloseIcon size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      {rows.length < max && (
        <button type="button" onClick={() => Q.store.edit((st) => addRow(st, Q.scope, q.id))} className="inline-flex items-center gap-1 py-2 text-[14px] font-semibold text-navy hover:underline">
          <PlusIcon size={14} /> {links ? "Add a link" : "Add another"}
        </button>
      )}
    </div>
  );
}

function PairsEdit() {
  const Q = useQ();
  const val = (makeCtx(Q.store.state, Q.scope).get("v_pairs") as Record<string, number | "decide"> | undefined) ?? {};
  return (
    <div className="grid gap-3">
      {PAIRS.map(([pk, l, lc, r, rc]) => {
        const cur = val[pk];
        return (
          <div
            key={pk}
            role="radiogroup"
            aria-label={`${l} or ${r}`}
            className="grid grid-cols-2 items-center gap-3.5 rounded-tile-sm bg-white px-[18px] py-3.5 [grid-template-areas:'l_r''s_s''d_d'] md:grid-cols-[150px_1fr_150px_92px] md:[grid-template-areas:'l_s_r_d']"
          >
            <div className="flex items-center gap-2.5 text-[15px] font-[530] [grid-area:l]">
              <span className="size-[26px] shrink-0 rounded-tag" style={{ background: lc }} aria-hidden="true" />
              {l}
            </div>
            <div className="relative flex items-center justify-between [grid-area:s] before:absolute before:inset-x-3 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-line">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={cur === n}
                  aria-label={`${l} ${n} of 5 ${r}`}
                  onClick={() => Q.store.edit((st) => setPair(st, Q.scope, pk, n))}
                  className={cn(
                    "relative size-[26px] rounded-full border-2 transition-[transform,background-color,border-color] duration-150 hover:scale-[1.15]",
                    cur === n ? "scale-[1.2] border-navy bg-navy" : "border-mist bg-white",
                  )}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-2.5 text-right text-[15px] font-[530] [grid-area:r]">
              {r}
              <span className="size-[26px] shrink-0 rounded-tag" style={{ background: rc }} aria-hidden="true" />
            </div>
            <div className="[grid-area:d]">
              <Chip decide noCheck size="sm" selected={cur === "decide"} className="w-full justify-center" onSelectedChange={() => Q.store.edit((st) => setPair(st, Q.scope, pk, "decide"))}>
                Up to you
              </Chip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MoodEdit() {
  const Q = useQ();
  const c = makeCtx(Q.store.state, Q.scope);
  const sel = c.arr("v_mood") as string[];
  const decide = Boolean(c.get("v_mood_decide"));
  const [shake, setShake] = useState<string | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {MOOD.map(([mk, cap]) => {
          const i = sel.indexOf(mk);
          return (
            <motion.button
              key={mk}
              type="button"
              aria-pressed={i >= 0}
              aria-label={cap}
              animate={shake === mk ? { x: [0, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              onClick={() => {
                const err = Q.store.edit((st) => toggleMood(st, Q.scope, mk));
                if (err) {
                  setShake(mk);
                  window.setTimeout(() => setShake(null), 400);
                  Q.toast(err);
                }
              }}
              className={cn(
                "relative aspect-[4/3] overflow-hidden rounded-tile-sm border-[3px] transition-[border-color,transform] duration-200 hover:-translate-y-0.5",
                i >= 0 ? "border-navy" : "border-transparent",
              )}
              style={MOOD_BG[mk]}
            >
              <MoodArt mk={mk} />
              <span className="absolute bottom-2.5 left-2.5 rounded-tag bg-white/90 px-2 py-1 text-[13px] font-semibold">{cap}</span>
              <AnimatePresence>
                {i >= 0 && (
                  <motion.span
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={SPRING}
                    className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-navy text-[14px] font-bold text-white"
                  >
                    {i + 1}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip decide noCheck selected={decide} onSelectedChange={() => Q.store.edit((st) => toggleMoodDecide(st, Q.scope))}>
          Up to you
        </Chip>
        <span className="text-[13px] tabular-nums text-muted">{sel.length} of 3</span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only: answers as text and chosen chips                         */
/* ------------------------------------------------------------------ */

function NoAnswer() {
  return <p className="text-body text-muted">No answer</p>;
}

function Pills({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <span key={v} className={cn("inline-flex h-9 items-center rounded-full px-4 text-[15px]", v === DECIDE ? "bg-sky text-navy" : "bg-navy text-white")}>
          {v}
        </span>
      ))}
    </div>
  );
}

const safeHref = (url: string) => (/^https?:\/\//i.test(url) ? url : /^[\w-]+(\.[\w-]+)+/.test(url) ? `https://${url}` : null);

function Read({ q }: { q: Question }) {
  const Q = useQ();
  const c = makeCtx(Q.store.state, Q.scope);
  const v = c.get(q.id);
  switch (q.type) {
    case "text": {
      const partner = q.half ? questionById(q.half) : undefined;
      const main = String(v ?? "").trim();
      const second = partner ? String(c.get(partner.id) ?? "").trim() : "";
      if (!main && !second) return <NoAnswer />;
      return (
        <p className="text-lead">
          {main || <span className="text-muted">—</span>}
          {second && <span className="text-muted"> · {text(partner!.label, c)}: {second}</span>}
        </p>
      );
    }
    case "short":
      return String(v ?? "").trim() ? <p className="whitespace-pre-line text-lead">{String(v)}</p> : <NoAnswer />;
    case "chips":
    case "months": {
      const vals = (Array.isArray(v) ? v : v ? [v] : []) as string[];
      if (!vals.length) return <NoAnswer />;
      const other = String(c.get(q.id + "__other") ?? "").trim();
      return (
        <>
          <Pills values={vals.map((x) => (x === "Other" && other ? `Other: ${other}` : x))} />
        </>
      );
    }
    case "pick": {
      const vals = [...(c.get(q.id + "_world") ? ["Worldwide"] : []), ...((Array.isArray(v) ? v : []) as string[])];
      return vals.length ? <Pills values={vals} /> : <NoAnswer />;
    }
    case "rows":
    case "links": {
      const rows = ((Array.isArray(v) ? v : []) as Row[]).filter((r) => r.a || r.b);
      if (!rows.length) return <NoAnswer />;
      return (
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const href = q.type === "links" && r.a ? safeHref(r.a) : null;
            return (
              <li key={i} className="flex items-baseline gap-2 rounded-tile-sm bg-white px-4 py-3 text-body">
                {r.s && <span className="text-orange" aria-label="Most important now">★</span>}
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline decoration-mist underline-offset-4 hover:decoration-navy">
                    {r.a}
                  </a>
                ) : (
                  <span className="font-medium">{r.a}</span>
                )}
                {r.b && <span className="text-muted">— {r.b}</span>}
              </li>
            );
          })}
        </ul>
      );
    }
    case "pairs": {
      const val = (v as Record<string, number | "decide"> | undefined) ?? {};
      return (
        <div className="grid gap-2">
          {PAIRS.map(([pk, l, , r]) => (
            <div key={pk} className="grid grid-cols-[110px_1fr_110px] items-center gap-3 rounded-tile-sm bg-white px-4 py-3 text-small sm:grid-cols-[150px_1fr_150px]">
              <span className="font-medium">{l}</span>
              {val[pk] === "decide" ? (
                <span className="justify-self-center rounded-full bg-sky px-3 py-1 text-caption font-medium">Up to you</span>
              ) : (
                <span className="relative flex items-center justify-between before:absolute before:inset-x-2 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-line" aria-label={val[pk] ? `${val[pk]} of 5` : "No answer"}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={cn("relative size-3.5 rounded-full border-2", val[pk] === n ? "border-navy bg-navy" : "border-mist bg-white")} />
                  ))}
                </span>
              )}
              <span className="text-right font-medium">{r}</span>
            </div>
          ))}
        </div>
      );
    }
    case "mood": {
      const sel = (Array.isArray(v) ? v : []) as string[];
      if (c.get("v_mood_decide")) return <Pills values={[DECIDE]} />;
      if (!sel.length) return <NoAnswer />;
      return (
        <div className="grid grid-cols-3 gap-3 md:max-w-xl">
          {sel.map((mk, i) => (
            <div key={mk} className="relative aspect-[4/3] overflow-hidden rounded-tile-sm" style={MOOD_BG[mk]}>
              <MoodArt mk={mk} />
              <span className="absolute bottom-2 left-2 rounded-tag bg-white/90 px-2 py-0.5 text-caption font-semibold">{MOOD.find((m) => m[0] === mk)?.[1]}</span>
              <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-navy text-caption font-bold text-white">{i + 1}</span>
            </div>
          ))}
        </div>
      );
    }
    case "notyou": {
      const cap = MOOD.find((m) => m[0] === v)?.[1];
      return cap ? <Pills values={[cap]} /> : <NoAnswer />;
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

export function Tick({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 py-1.5 text-[16px]", disabled && "cursor-not-allowed opacity-45")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer mt-px grid size-[22px] shrink-0 cursor-pointer appearance-none place-items-center rounded-[6px] border-2 border-mist bg-white transition-colors checked:border-navy checked:bg-navy disabled:cursor-not-allowed after:hidden checked:after:block after:h-[11px] after:w-1.5 after:-translate-y-px after:rotate-45 after:border-b-2 after:border-r-2 after:border-white after:content-['']"
      />
      <span>{children}</span>
    </label>
  );
}

function ReadTick({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[16px]">
      <span className={cn("grid size-[22px] place-items-center rounded-[6px] border-2", on ? "border-navy bg-navy text-white" : "border-mist")} aria-hidden="true">
        {on && "✓"}
      </span>
      <span className={on ? "" : "text-muted"}>{children}</span>
    </p>
  );
}

function BrandingAddon() {
  const Q = useQ();
  const asked = Boolean(Q.store.state.a.ask_branding);
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-tile-sm bg-white px-[18px] py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex-1">
        <p className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">+ Add-on</p>
        <p className="font-semibold">Branding</p>
        <p className="mt-0.5 text-[14px] text-muted">We can build it with you: identity update, visual tone, social guide, deck template. Ordered separately.</p>
      </div>
      {!Q.readOnly && (
        <button
          type="button"
          disabled={asked}
          onClick={() => {
            Q.store.edit((st) => setAnswer(st, null, "ask_branding", true));
            Q.toast("Noted. We'll talk about branding on the call.");
          }}
          className="rounded-full bg-gray px-3 py-1.5 text-small font-medium transition-colors hover:bg-gray-strong disabled:cursor-default disabled:bg-ok-soft disabled:text-ok"
        >
          {asked ? "We'll talk about it" : "Ask about branding"}
        </button>
      )}
    </div>
  );
}

/* Mood tiles: placeholders drawn in CSS, as in the prototype. */
const MOOD_BG: Record<string, CSSProperties> = {
  daylight: { background: "linear-gradient(160deg,#FFF6E8,#F3D9B8 60%,#E9C49A)" },
  studio: { background: "radial-gradient(circle at 60% 35%,#4a5864,#11171c 65%)" },
  blocks: { background: "conic-gradient(from 90deg at 45% 55%,#FF4F17 0 25%,#FFD166 0 50%,#0C2B3F 0 75%,#B4E4FA 0)" },
  type: { background: "#F1F1F1" },
  people: { background: "linear-gradient(180deg,#d9e6ee,#b8ccd8)" },
  closeup: { background: "radial-gradient(circle at 50% 120%,#c9d6df,#eef3f6 70%)" },
  craft: { background: "repeating-linear-gradient(45deg,#e8dccb 0 6px,#dccbb3 6px 12px)" },
  ui: { background: "linear-gradient(180deg,#0C2B3F,#1D4A66)" },
  toy: { background: "linear-gradient(135deg,#ffe3ec,#e3e9ff)" },
};

function MoodArt({ mk }: { mk: string }) {
  const a = "absolute";
  switch (mk) {
    case "daylight":
      return (
        <>
          <i className={a} style={{ width: "46%", aspectRatio: "1", borderRadius: "50%", background: "#fff3d6", filter: "blur(8px)", right: "10%", top: "12%" }} />
          <i className={a} style={{ left: 0, right: 0, bottom: 0, height: "35%", background: "linear-gradient(transparent,rgba(176,124,74,.35))" }} />
        </>
      );
    case "studio":
      return <i className={a} style={{ width: "30%", height: "48%", borderRadius: "40% 40% 10% 10%", background: "linear-gradient(90deg,#2a3239,#8d9aa4 45%,#2a3239)", left: "35%", top: "24%" }} />;
    case "type":
      return (
        <i className={a} style={{ fontStyle: "normal", fontWeight: 700, fontSize: "min(9vw,88px)", left: 12, top: -6, color: "#0C2B3F", letterSpacing: "-.04em" }}>
          Aa
        </i>
      );
    case "people":
      return (
        <>
          <i className={a} style={{ width: "22%", aspectRatio: "1", borderRadius: "50%", background: "#7d93a2", left: "39%", top: "18%" }} />
          <i className={a} style={{ width: "46%", height: "42%", borderRadius: "50% 50% 0 0", background: "#7d93a2", left: "27%", bottom: 0 }} />
        </>
      );
    case "closeup":
      return <i className={a} style={{ width: "34%", height: "58%", borderRadius: 18, background: "linear-gradient(120deg,#fff,#d7e2ea)", boxShadow: "0 18px 30px rgba(12,43,63,.25)", left: "33%", top: "14%" }} />;
    case "craft":
      return <i className={a} style={{ width: "40%", aspectRatio: "1", borderRadius: "50%", border: "6px dotted #a5774f", left: "30%", top: "16%" }} />;
    case "ui":
      return (
        <>
          <i className={a} style={{ width: "30%", height: "76%", borderRadius: 14, background: "#F3FBFF", left: "35%", top: "12%" }} />
          <i className={a} style={{ width: "20%", height: "6%", borderRadius: 4, background: "#B4E4FA", left: "40%", top: "24%" }} />
          <i className={a} style={{ width: "20%", height: "6%", borderRadius: 4, background: "#DDE3E8", left: "40%", top: "36%" }} />
          <i className={a} style={{ width: "20%", height: "6%", borderRadius: 4, background: "#FF4F17", left: "40%", top: "70%" }} />
        </>
      );
    case "toy":
      return (
        <>
          <i className={a} style={{ width: "30%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff,#ff8fb1 45%,#c2185b)", left: "18%", top: "28%" }} />
          <i className={a} style={{ width: "22%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff,#8fa8ff 45%,#3949ab)", left: "55%", top: "20%" }} />
        </>
      );
    default:
      return null;
  }
}
