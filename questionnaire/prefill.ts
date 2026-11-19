import { CTAS, DEFAULT_FORMATS, DEFAULT_LENGTH, GOALS, OFFERS, UP_TO_YOU, type BriefAnswers, type CampaignSetup } from "@/lib/brief";
import { LANGUAGES, type FormatId } from "@/lib/forma-constants";
import { DECIDE } from "./schema";
import { makeCtx, type QState, type Scope } from "./logic";

/**
 * Prefills a campaign brief from the brand questionnaire ("What we'll make",
 * goals, offer, CTA, languages). "Up to you" answers become our defaults.
 * For an agency client, `scope` is the client's questionnaire id ("c1").
 */

const FORMAT_MAP: Record<string, FormatId> = {
  "Vertical 9:16": "9x16",
  "Portrait 4:5": "4x5",
  "Square 1:1": "1x1",
  "Wide 16:9": "16x9",
  "Banner sizes": "191x1",
};

/** Questionnaire language names ("Chinese (Simplified)") → Forma codes ("zh"). */
const LANG_NAME_TO_CODE: Record<string, string> = {
  ...Object.fromEntries(LANGUAGES.map((l) => [l.name, l.code])),
  Serbian: "sr-Latn",
  "Chinese (Simplified)": "zh",
  "Chinese (Traditional)": "zh",
};

export interface BriefPrefill {
  setup: CampaignSetup;
  brief: Omit<BriefAnswers, "requestId">;
  /** Starred products first, then the rest: the "pick" options for the product field. */
  products: string[];
  /** The client's own goals first. */
  goals: string[];
  ctas: string[];
}

export function prefillBrief(s: QState, scope: Scope): BriefPrefill {
  const c = makeCtx(s, scope);
  const arr = (id: string) => c.arr(id).filter((x): x is string => typeof x === "string");

  const rows = (c.arr("p_list") as { a?: string; s?: boolean }[]).filter((r) => r?.a?.trim());
  const products = [...rows.filter((r) => r.s), ...rows.filter((r) => !r.s)].map((r) => r.a!.trim());

  const clientGoals = arr("d_goals").filter((g) => g !== "Other");
  const goals = [...new Set([...clientGoals, ...GOALS])];
  const main = c.get("d_main");
  const goal = typeof main === "string" && main ? main : clientGoals[0] ?? "";

  const offerAns = c.get("k_offer");
  const offer = typeof offerAns === "string" ? (offerAns === "Other" ? String(c.get("k_offer__other") ?? "") || "Other" : offerAns) : "";

  const ctaAns = arr("k_cta");
  const ctaOther = String(c.get("k_cta__other") ?? "").trim();
  const ctas = [...new Set([...ctaAns.filter((x) => x !== DECIDE && x !== "Other"), ...(ctaOther ? [ctaOther] : []), ...CTAS])];
  const cta = ctaAns.includes(DECIDE) ? UP_TO_YOU : ctaAns.find((x) => x !== "Other") ?? (ctaOther || "");

  // What we'll make
  const what = arr("k_what");
  const video = what.includes("Video ads") || what.includes(DECIDE) || what.length === 0;
  const kind: CampaignSetup["kind"] = what.length && !video && what.includes("Static ads") ? "poster" : video ? "multi" : "poster";

  const fmtAns = arr("k_formats");
  const fmts = fmtAns.includes(DECIDE) || !fmtAns.length ? DEFAULT_FORMATS : [...new Set(fmtAns.map((f) => FORMAT_MAP[f]).filter(Boolean))];

  const lenAns = arr("k_len");
  const lens = lenAns.includes(DECIDE) || !lenAns.length ? [DEFAULT_LENGTH] : lenAns.map((l) => parseInt(l, 10)).filter((n) => [6, 8, 10, 12, 15].includes(n));

  const langNames = arr("k_langs").length ? arr("k_langs") : arr("c_langs");
  const languages = [...new Set(langNames.map((n) => LANG_NAME_TO_CODE[n]).filter(Boolean))];

  return {
    setup: {
      kind,
      formats: fmts.length ? fmts : DEFAULT_FORMATS,
      lengths: kind === "poster" ? [] : lens.length ? lens : [DEFAULT_LENGTH],
      languages: languages.length ? languages : ["en"],
    },
    brief: {
      product: products[0] ?? "",
      promote: String(c.get("d_next") ?? "").trim(),
      goal,
      offer: OFFERS.includes(offer) || offer === "" ? offer : offer,
      offerText: "",
      cta,
      links: [],
      fileIds: [],
      note: "",
    },
    products,
    goals,
    ctas,
  };
}
