import {
  BRAND_STEPS,
  CLIENT_SECS,
  DECIDE,
  MOOD,
  PAIRS,
  SEC,
  SEC_NAMES,
  questionById,
  type Ctx,
  type Question,
  type Text,
} from "./schema";

/**
 * The prototype's logic as pure functions over an explicit state and scope
 * (the prototype used globals `S` and `SCOPE`). Same rules, same results:
 * logic.test.ts reproduces them on fixtures.
 */

export type Role = "brand" | "agency";
export type Mode = "self" | "call" | "ai";
export type AnswerFlag = "file" | "prefill";

export interface Signature {
  by: string;
  company: string;
  at: string;
  docVersion: string;
  documentHash: string;
  userAgent: string | null;
}

export interface LegalState {
  company?: string;
  name?: string;
  nda?: Signature | null;
  ndaOwn?: boolean;
  terms?: Signature | null;
  caseStudy?: boolean;
}

/** What is stored in brand_questionnaires.state (the prototype's S minus UI-only keys: step, ac, notes, files). */
export interface QState {
  role: Role | null;
  mode: Mode | null;
  a: Record<string, unknown>;
  flags: Record<string, AnswerFlag>;
  clients: { id: string }[];
  legal: LegalState;
}

/** Scope: null for the brand (or the agency's own section), a client id for an agency client. */
export type Scope = string | null;

export const blankState = (): QState => ({ role: null, mode: null, a: {}, flags: {}, clients: [{ id: "c1" }], legal: {} });

export const scopedKey = (scope: Scope, id: string) => (scope ? `${scope}:${id}` : id);

export const isEmpty = (v: unknown): boolean =>
  v == null ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

export const isAgency = (s: QState) => s.role === "agency";

export function makeCtx(s: QState, scope: Scope): Ctx {
  const get = (id: string) => s.a[scopedKey(scope, id)];
  const arr = (id: string) => {
    const v = get(id);
    return Array.isArray(v) ? v : [];
  };
  return {
    get,
    arr,
    has: (id, o) => {
      const v = get(id);
      return Array.isArray(v) ? v.includes(o) : v === o;
    },
    isAgency: isAgency(s),
    inClient: scope !== null,
  };
}

export const text = (t: Text | undefined, c: Ctx): string => (t === undefined ? "" : typeof t === "function" ? t(c) : t);

/* ============ Steps ============ */

export function steps(s: QState): string[] {
  if (!isAgency(s)) return BRAND_STEPS;
  const out = ["welcome", "agency"];
  for (const c of s.clients) for (const sec of CLIENT_SECS) out.push(`${c.id}|${sec}`);
  return out.concat(["legal", "review"]);
}

export function parseStep(st: string): { cid: string | null; sec: string } {
  return st.includes("|") ? { cid: st.split("|")[0], sec: st.split("|")[1] } : { cid: null, sec: st };
}

/** URL segment for a step ("c1|company" → "c1-company"), as the prototype's hash links. */
export const stepSlug = (st: string) => st.replace("|", "-");
export function slugToStep(slug: string | undefined | null, s: QState): string | null {
  if (!slug) return null;
  const st = slug.replace("-", "|");
  return steps(s).includes(st) || st === "done" ? st : null;
}

export function clientName(s: QState, cid: string): string {
  const v = s.a[`${cid}:c_company`];
  const i = s.clients.findIndex((c) => c.id === cid);
  return typeof v === "string" && v ? v : `Client ${i + 1}`;
}

export function sectionTitle(s: QState, sec: string, cid: string | null): string {
  return SEC_NAMES[sec] ?? text(SEC[sec]?.title, makeCtx(s, cid));
}

/* ============ Visibility & completion ============ */

export function visible(s: QState, scope: Scope, q: Question): boolean {
  if (q.skipRender) return false;
  if (q.agency && !(isAgency(s) && scope)) return false;
  if (q.brandOnly && isAgency(s)) return false;
  if (q.show && !q.show(makeCtx(s, scope))) return false;
  return true;
}

export function answered(s: QState, scope: Scope, q: Question): boolean {
  const c = makeCtx(s, scope);
  const v = c.get(q.id);
  if (q.type === "rows") return Array.isArray(v) && v.some((r) => r && (r as { a?: string }).a);
  if (q.type === "pairs") return !!v && PAIRS.every((p) => (v as Record<string, unknown>)[p[0]] != null);
  if (q.type === "pick") return !isEmpty(v) || !!(q.world && c.get(q.id + "_world"));
  if (q.type === "mood") return !isEmpty(v) || !!c.get("v_mood_decide");
  return !isEmpty(v);
}

export function legalOk(s: QState): boolean {
  const l = s.legal;
  return !!(l.name && l.company && l.terms && (l.nda || l.ndaOwn));
}

export interface SecStatus {
  req: number;
  done: number;
  missing: { id: string; key: string; label: string }[];
}

export function secStatus(s: QState, sec: string, cid: string | null): SecStatus {
  if (sec === "legal") {
    const ok = legalOk(s);
    const any = s.legal.name || s.legal.nda || s.legal.terms;
    return { req: 3, done: ok ? 3 : any ? 1 : 0, missing: ok ? [] : [{ id: "legal", key: "legal", label: "NDA and terms" }] };
  }
  if (!SEC[sec]) return { req: 0, done: 0, missing: [] };
  const c = makeCtx(s, cid);
  const qs = SEC[sec].qs.filter((q) => visible(s, cid, q) && q.req);
  const miss = qs.filter((q) => !answered(s, cid, q));
  return {
    req: qs.length,
    done: qs.length - miss.length,
    missing: miss.map((q) => ({ id: q.id, key: scopedKey(cid, q.id), label: text(q.label, c) })),
  };
}

export function totals(s: QState): { req: number; done: number } {
  let req = 0;
  let done = 0;
  for (const st of steps(s)) {
    const p = parseStep(st);
    const r = secStatus(s, p.sec, p.cid);
    req += r.req;
    done += r.done;
  }
  return { req, done };
}

export function minutesLeft(s: QState): number {
  let m = 0;
  for (const st of steps(s)) {
    const p = parseStep(st);
    if (!SEC[p.sec] && p.sec !== "legal" && p.sec !== "agency") continue;
    const r = secStatus(s, p.sec, p.cid);
    const min = p.sec === "legal" ? 2 : SEC[p.sec]?.min ?? 0;
    if (r.req) m += min * (1 - r.done / r.req);
  }
  return Math.max(0, Math.round(m));
}

/** Everything that blocks sending (spec §6.2: complete answers and both documents). */
export function missingForSend(s: QState): { step: string; title: string; label: string; key: string }[] {
  const out: { step: string; title: string; label: string; key: string }[] = [];
  for (const st of steps(s)) {
    const p = parseStep(st);
    if (p.sec === "welcome" || p.sec === "review") continue;
    const r = secStatus(s, p.sec, p.cid);
    const title = (p.cid ? clientName(s, p.cid) + " · " : "") + sectionTitle(s, p.sec, p.cid);
    for (const m of r.missing) out.push({ step: st, title, label: m.label, key: m.key });
  }
  if (!s.role) out.unshift({ step: "welcome", title: "Start", label: "Who's filling this in?", key: "role" });
  return out;
}

export interface ReviewItem {
  step: string;
  title: string;
  status: SecStatus;
}

export function reviewSummary(s: QState): { items: ReviewItem[]; decide: string[]; unsure: string[] } {
  const items: ReviewItem[] = [];
  const decide: string[] = [];
  const unsure: string[] = [];
  for (const st of steps(s)) {
    const p = parseStep(st);
    if (p.sec === "welcome" || p.sec === "review") continue;
    items.push({ step: st, title: (p.cid ? clientName(s, p.cid) + " · " : "") + sectionTitle(s, p.sec, p.cid), status: secStatus(s, p.sec, p.cid) });
    const sec = SEC[p.sec];
    if (!sec) continue;
    const c = makeCtx(s, p.cid);
    const prefix = p.cid ? clientName(s, p.cid) + ": " : "";
    for (const q of sec.qs.filter((q) => visible(s, p.cid, q))) {
      const v = c.get(q.id);
      const vals = Array.isArray(v) ? v : [v];
      if (
        vals.includes(DECIDE) ||
        (q.type === "pairs" && v && Object.values(v as object).includes("decide")) ||
        (q.type === "mood" && c.get("v_mood_decide"))
      )
        decide.push(prefix + text(q.label, c));
      if (vals.some((x) => x === "Not sure" || x === "Hard to say" || x === "Not sure yet")) unsure.push(prefix + text(q.label, c));
    }
  }
  return { items, decide, unsure };
}

/* ============ Editing (pure; each returns a new state) ============ */

/** Sets an answer and clears its "check" flag, as the prototype's set(). */
export function setAnswer(s: QState, scope: Scope, id: string, value: unknown): QState {
  const k = scopedKey(scope, id);
  const a = { ...s.a };
  if (value === null || value === undefined) delete a[k];
  else a[k] = value;
  const flags = { ...s.flags };
  delete flags[k];
  return { ...s, a, flags };
}

export type EditResult = { state: QState; error?: string };

export function pickChip(s: QState, scope: Scope, q: Question, o: string): EditResult {
  const c = makeCtx(s, scope);
  const multi = q.multi || q.type === "months" || q.type === "pick";
  if (!multi) return { state: setAnswer(s, scope, q.id, c.get(q.id) === o ? null : o) };
  let v = (c.arr(q.id) as string[]).slice();
  if (v.includes(o)) v = v.filter((x) => x !== o);
  else {
    const exclusive = (q.excl ?? []).concat(q.decide ? [DECIDE] : []);
    if (exclusive.includes(o)) v = [o];
    else {
      v = v.filter((x) => !exclusive.includes(x));
      if (q.max && v.length >= q.max) return { state: s, error: `Up to ${q.max} — tap one to swap` };
      v.push(o);
    }
  }
  let next = setAnswer(s, scope, q.id, v);
  if (q.id === "d_goals") {
    const main = makeCtx(next, scope).get("d_main");
    if (main && !v.includes(main as string)) next = setAnswer(next, scope, "d_main", null);
  }
  return { state: next };
}

export function toggleWorld(s: QState, scope: Scope, id: string): QState {
  return setAnswer(s, scope, id + "_world", !makeCtx(s, scope).get(id + "_world"));
}

export function applySameAs(s: QState, scope: Scope, q: Question): QState {
  if (!q.sameAs) return s;
  return setAnswer(s, scope, q.id, (makeCtx(s, scope).arr(q.sameAs) as string[]).slice());
}

type Row = { a?: string; b?: string; s?: boolean };
const rowsOf = (s: QState, scope: Scope, id: string): Row[] => {
  const v = makeCtx(s, scope).get(id);
  return Array.isArray(v) && v.length ? (v as Row[]).map((r) => ({ ...r })) : [{}];
};

export function addRow(s: QState, scope: Scope, id: string): QState {
  return setAnswer(s, scope, id, [...rowsOf(s, scope, id), {}]);
}
export function deleteRow(s: QState, scope: Scope, id: string, i: number): QState {
  const v = rowsOf(s, scope, id);
  v.splice(i, 1);
  return setAnswer(s, scope, id, v);
}
export function setRowField(s: QState, scope: Scope, id: string, i: number, field: "a" | "b", value: string): QState {
  const v = rowsOf(s, scope, id);
  while (v.length <= i) v.push({});
  v[i] = { ...v[i], [field]: value };
  return setAnswer(s, scope, id, v);
}
export function toggleStar(s: QState, scope: Scope, id: string, i: number): EditResult {
  const v = rowsOf(s, scope, id);
  const on = v.filter((x) => x.s).length;
  if (!v[i]?.s && on >= 3) return { state: s, error: "Star up to 3" };
  v[i] = { ...v[i], s: !v[i]?.s };
  return { state: setAnswer(s, scope, id, v) };
}

export function setPair(s: QState, scope: Scope, pair: string, n: number | "decide"): QState {
  const cur = { ...((makeCtx(s, scope).get("v_pairs") as Record<string, unknown>) ?? {}) };
  if (n === "decide") {
    if (cur[pair] === "decide") delete cur[pair];
    else cur[pair] = "decide";
  } else cur[pair] = n;
  return setAnswer(s, scope, "v_pairs", cur);
}

export function toggleMood(s: QState, scope: Scope, mk: string): EditResult {
  const c = makeCtx(s, scope);
  let v = (c.arr("v_mood") as string[]).slice();
  if (v.includes(mk)) v = v.filter((x) => x !== mk);
  else {
    if (v.length >= 3) return { state: s, error: "Up to 3 — tap one to swap" };
    v.push(mk);
  }
  let next = setAnswer(s, scope, "v_mood", v);
  if (v.length) next = setAnswer(next, scope, "v_mood_decide", false);
  if (makeCtx(next, scope).get("v_not") === mk) next = setAnswer(next, scope, "v_not", null);
  return { state: next };
}

export function toggleMoodDecide(s: QState, scope: Scope): QState {
  const nv = !makeCtx(s, scope).get("v_mood_decide");
  let next = setAnswer(s, scope, "v_mood_decide", nv);
  if (nv) next = setAnswer(next, scope, "v_mood", []);
  return next;
}

export function toggleNot(s: QState, scope: Scope, mk: string): QState {
  return setAnswer(s, scope, "v_not", makeCtx(s, scope).get("v_not") === mk ? null : mk);
}

export function setRole(s: QState, role: Role): QState {
  return { ...s, role, clients: role === "agency" && !s.clients.length ? [{ id: "c1" }] : s.clients };
}

export function addClient(s: QState): { state: QState; id: string } {
  const n = Math.max(0, ...s.clients.map((c) => Number(c.id.replace(/\D/g, "")) || 0)) + 1;
  const id = `c${n}`;
  return { state: { ...s, clients: [...s.clients, { id }] }, id };
}

export function removeClient(s: QState, cid: string): QState {
  if (s.clients.length <= 1) return s;
  const a = Object.fromEntries(Object.entries(s.a).filter(([k]) => !k.startsWith(cid + ":")));
  const flags = Object.fromEntries(Object.entries(s.flags).filter(([k]) => !k.startsWith(cid + ":"))) as QState["flags"];
  return { ...s, a, flags, clients: s.clients.filter((c) => c.id !== cid) };
}

/* ============ Approval helpers ============ */

/** One client brand per brand account, or one per agency client, named from c_company (spec §4.1). */
export function brandsForApproval(s: QState): { name: string; questionnaire_scope: string | null }[] {
  if (!isAgency(s)) return [{ name: String(s.a.c_company ?? "").trim() || "Your brand", questionnaire_scope: null }];
  return s.clients.map((c) => ({ name: clientName(s, c.id), questionnaire_scope: c.id }));
}

export function accountName(s: QState): string | null {
  const v = isAgency(s) ? s.a.g_name : s.a.c_company;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * While changes are requested, only the flagged answers unlock, with the pieces
 * that belong to them ("Other" text, Worldwide, mood "Up to you").
 */
export function isKeyUnlocked(key: string, unlocked: string[]): boolean {
  for (const u of unlocked) {
    if (key === u || key === u + "__other" || key === u + "_world") return true;
    const base = u.slice(u.lastIndexOf(":") + 1);
    const prefix = u.slice(0, u.length - base.length);
    if (base === "v_mood" && key === prefix + "v_mood_decide") return true;
    const q = questionById(base);
    if (q?.half && key === prefix + q.half) return true;
  }
  return false;
}

/* ============ AI assistant export / import ============ */

const aiSections = (s: QState) =>
  isAgency(s) ? ["agency", "company", "product", "people", "market", "ads", "make"] : ["company", "product", "people", "market", "ads", "make"];

export function exportQuestions(s: QState): string {
  const c = makeCtx(s, isAgency(s) ? "c-export" : null);
  let md = `# Toggle Concepts — brand questionnaire\n\nYou are helping ${isAgency(s) ? "an agency" : "a company"} fill in a questionnaire for Toggle Concepts, a creative department that makes their ads.\nUse the materials I attach (website, brand book, deck). Answer every question in plain, short words.\nFor choice questions, pick from the listed options only. If you don't know, write "Not sure". Never invent numbers, reviews or clients.\nKeep the format exactly: the heading line, then "Answer:" with your answer.\n\n`;
  for (const secId of aiSections(s)) {
    md += `## ${text(SEC[secId].title, c)}\n\n`;
    for (const q of SEC[secId].qs) {
      if (q.skipRender || ["pairs", "mood", "notyou", "files", "tick"].includes(q.type) || (q.agency && !isAgency(s)) || (q.brandOnly && isAgency(s))) continue;
      const all = [q].concat(q.half ? [questionById(q.half)!] : []);
      for (const x of all) {
        md += `### [${x.id}] ${text(x.label, c)}\n`;
        if (x.type === "chips" && x.opts)
          md += `Options (${x.multi ? "pick any" + (x.max ? `, up to ${x.max}` : "") : "pick one"}): ${x.opts.concat(x.decide ? [DECIDE] : []).join(" · ")}\n`;
        if (x.type === "rows") md += `Up to ${x.max}, one per line: ${x.cols!.join(" — ")}\n`;
        if (x.type === "pick") md += `List them, comma-separated.\n`;
        md += `Answer: \n\n`;
      }
    }
  }
  return md;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Fills answers from an assistant's reply and marks them "From your file · check".
 * Port of the prototype's importAnswers, with one fix: an answer runs to the next
 * blank line, so multi-line answers (product rows) keep every line.
 */
export function importAnswers(s: QState, txt: string): { state: QState; count: number } {
  let count = 0;
  const a = { ...s.a };
  const flags = { ...s.flags };
  const blocks = txt.split(/^###\s*\[/m).slice(1);
  for (const b of blocks) {
    const id = b.slice(0, b.indexOf("]")).trim();
    const m = b.match(/Answer:[ \t]*\n?([\s\S]*)/);
    const ans = m ? m[1].trim().split(/\n\s*\n/)[0].trim() : "";
    if (!ans) continue;
    const q = questionById(id);
    if (!q) continue;
    const key = isAgency(s) && q.id[0] !== "g" ? `${s.clients[0].id}:${id}` : id;
    let val: unknown = null;
    if (q.type === "chips" && q.opts) {
      const opts = q.opts.concat(q.decide ? [DECIDE] : []);
      const hits = opts.filter((o) => ans.toLowerCase().includes(o.toLowerCase()));
      if (hits.length) val = q.multi ? hits.slice(0, q.max || 99) : hits[0];
    } else if (q.type === "pick" && q.list) {
      const hits = q.list.filter((o) => new RegExp("\\b" + escapeRe(o) + "\\b", "i").test(ans));
      if (hits.length) val = hits;
    } else if (q.type === "rows") {
      val = ans
        .split(/\n/)
        .map((l) => l.replace(/^[-*\d.\s]+/, ""))
        .filter(Boolean)
        .slice(0, q.max)
        .map((l) => {
          const [first, ...rest] = l.split(/\s[—–-]\s|:\s/);
          return { a: first.trim(), b: rest.join(" ").trim() };
        });
    } else if (q.type === "text" || q.type === "short") val = ans;
    if (val && !(Array.isArray(val) && !val.length)) {
      a[key] = val;
      flags[key] = "file";
      count++;
    }
  }
  return { state: { ...s, a, flags }, count };
}

export function exportAnswers(s: QState): string {
  let out = `Toggle Concepts questionnaire — ${isAgency(s) ? "agency" : "brand"}\n\n`;
  for (const st of steps(s)) {
    const p = parseStep(st);
    if (!SEC[p.sec]) continue;
    const c = makeCtx(s, p.cid);
    out += `== ${(p.cid ? clientName(s, p.cid) + " · " : "") + text(SEC[p.sec].title, c)} ==\n`;
    for (const q of SEC[p.sec].qs.filter((q) => visible(s, p.cid, q) || q.skipRender)) {
      const v = c.get(q.id);
      if (isEmpty(v)) continue;
      out += `${text(q.label, c)}: ${formatValue(v)}\n`;
    }
    out += "\n";
  }
  return out;
}

export function formatValue(v: unknown): string {
  if (Array.isArray(v))
    return v
      .map((x) => (x && typeof x === "object" ? [(x as Row).a, (x as Row).b].filter(Boolean).join(" — ") + ((x as Row).s ? " ★" : "") : String(x)))
      .join("; ");
  if (v && typeof v === "object") return Object.entries(v).map(([k, b]) => `${k}: ${b}`).join(", ");
  return String(v);
}

/** "After the call" demo pre-fill (test mode). Marks answers "From our call · check"; never overwrites. */
export function demoFill(s: QState): QState {
  const pre = isAgency(s) ? s.clients[0].id + ":" : "";
  const D: Record<string, unknown> = {
    c_company: "Northwind", c_site: "https://northwind.example", c_what: "A budgeting app that helps young people save without thinking about it.",
    c_industry: ["Finance & fintech", "Apps & software"], c_buyers: "People (B2C)", c_markets: ["United Kingdom", "Germany", "Spain"],
    c_langs: ["English", "German", "Spanish"], c_size: "51–200", c_pay: ["Subscription"], d_goals: ["New customers", "Enter new markets"],
    d_main: "New customers", d_channels: ["Instagram & Facebook", "TikTok"],
  };
  const a = { ...s.a };
  const flags = { ...s.flags };
  for (const [id, v] of Object.entries(D)) {
    if (isEmpty(a[pre + id])) {
      a[pre + id] = v;
      flags[pre + id] = "prefill";
    }
  }
  return { ...s, a, flags };
}

/* ============ Files ============ */

/** The prototype's auto-category for a dropped file. */
export function catOf(name: string): string {
  const n = name.toLowerCase();
  const e = n.split(".").pop() ?? "";
  if (/brief/.test(n)) return "Briefs";
  if (["ttf", "otf", "woff", "woff2"].includes(e)) return "Fonts";
  if (/logo/.test(n) || ["svg", "ai", "eps"].includes(e)) return "Logos";
  if (e === "pdf" && /(brand|guide|book|identity)/.test(n)) return "Brand book";
  if (/(catalog|catalogue|price)/.test(n)) return "Catalog";
  if (["mp4", "mov", "webm", "m4v"].includes(e)) return /(ad|spot|reel|campaign)/.test(n) ? "Past ads" : "Video";
  if (["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(e)) return /(screen|ui|app)/.test(n) ? "Product screens" : /(ad|banner|creative)/.test(n) ? "Past ads" : "Photos";
  if (["fig", "aep", "psd", "sketch", "prproj"].includes(e)) return "Source files";
  if (["zip", "rar", "7z"].includes(e)) return "Archives (we unpack)";
  if (["pdf", "doc", "docx", "ppt", "pptx", "key", "xls", "xlsx", "csv"].includes(e)) return "Documents";
  return "Other";
}

/** The checklist under the drop zone lights up from real categories. */
export const FILE_CHECKLIST: [string, string][] = [["Logos", "Logo"], ["Fonts", "Fonts"], ["Brand book", "Brand book"], ["Photos", "Photos or product screens"], ["Past ads", "Past ads"]];
export function checklistDone(categories: string[], cat: string): boolean {
  return cat === "Photos" ? categories.includes("Photos") || categories.includes("Product screens") : categories.includes(cat);
}

export { MOOD, PAIRS, DECIDE };
