import { z } from "zod";
import { durations, formats, LANGUAGES, type FormatId } from "./forma-constants";

/**
 * The campaign brief (spec §6.5). The setup part mirrors Forma's
 * `validateSetup` (forma/campaigns.mjs): same rules, same messages, so a request
 * the dashboard accepts is one Forma accepts.
 */

export type CampaignKind = "poster" | "single" | "multi";

export interface CampaignSetup {
  kind: CampaignKind;
  formats: FormatId[];
  languages: string[];
  lengths: number[];
}

export interface BriefAnswers {
  /** Client-generated id: sending twice creates one campaign. */
  requestId: string;
  product: string;
  promote: string;
  goal: string;
  offer: string;
  offerText: string;
  cta: string;
  links: { a: string; b?: string }[];
  fileIds: string[];
  note: string;
}

export const KIND_OPTIONS: { value: CampaignKind; title: string; description: string }[] = [
  { value: "poster", title: "Static poster", description: "One strong frame in every format." },
  { value: "single", title: "Single-scene video (loop)", description: "One scene that moves and loops." },
  { value: "multi", title: "Multi-scene video (story)", description: "A short story told in scenes." },
];

/** Goals and offers from the questionnaire ("Your ads so far", "What we'll make"). */
export const GOALS = ["More sales", "New customers", "Get known", "Launch a new product", "Reach new people", "Enter new markets", "Bring customers back"];
export const OFFERS = ["No offer", "Discount", "Free trial", "Bonus or cashback"];
export const CTAS = ["Download", "Sign up", "Shop now", "Learn more", "Get started", "Book a demo", "Try for free"];
export const UP_TO_YOU = "Up to you";

const knownLangCodes = new Set(LANGUAGES.map((l) => l.code));

export class SetupError extends Error {
  constructor(public readonly field: "kind" | "languages" | "lengths" | "formats", message: string) {
    super(message);
    this.name = "SetupError";
  }
}

/** Forma's validateSetup, minus the provider settings Forma adds itself. */
export function validateSetup(raw: unknown): CampaignSetup {
  if (!raw || typeof raw !== "object") throw new SetupError("kind", "Invalid campaign settings.");
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (kind !== "poster" && kind !== "single" && kind !== "multi") {
    throw new SetupError("kind", "Choose a poster, single-scene video or multi-scene video.");
  }

  const rawLangs = Array.isArray(r.languages) ? r.languages : [];
  const languages = [...new Set(rawLangs.map((l) => (typeof l === "string" ? l.trim() : (l as { code?: string })?.code)).filter(Boolean) as string[])];
  if (!languages.length || !languages.every((code) => knownLangCodes.has(code) || /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code))) {
    throw new SetupError("languages", "Select at least one campaign language.");
  }

  let lengths: number[] = [];
  if (kind !== "poster") {
    const rawLengths = Array.isArray(r.lengths) ? r.lengths : [];
    lengths = [...new Set(rawLengths.map(Number))];
    const minLen = kind === "multi" ? 4 : 2;
    if (!lengths.length || !lengths.every((n) => Number.isFinite(n) && n >= minLen && n <= 60)) {
      throw new SetupError(
        "lengths",
        kind === "multi"
          ? "Choose lengths between 4 and 60 seconds for a multi-scene video."
          : "Choose lengths between 2 and 60 seconds for a single-scene video.",
      );
    }
  }

  const rawFormats = Array.isArray(r.formats) ? r.formats : [];
  const fmtIds = [...new Set(rawFormats.map((f) => (typeof f === "string" ? f : (f as { id?: string })?.id)).filter(Boolean) as string[])];
  if (!fmtIds.length || !fmtIds.every((id) => Object.hasOwn(formats, id))) {
    throw new SetupError("formats", "Select at least one format from the list.");
  }

  return { kind, languages, lengths, formats: fmtIds as FormatId[] };
}

const url = z.string().trim().max(500);

export const briefSchema = z.object({
  name: z.string().trim().min(1, "Give the campaign a name.").max(120, "Keep the name under 120 characters."),
  brandId: z.uuid(),
  setup: z.unknown(),
  brief: z.object({
    requestId: z.uuid(),
    product: z.string().trim().max(200).default(""),
    promote: z.string().trim().min(1, "Tell us what to promote.").max(2000),
    goal: z.string().trim().min(1, "Pick the goal.").max(200),
    offer: z.string().trim().max(200).default(""),
    offerText: z.string().trim().max(500).default(""),
    cta: z.string().trim().min(1, "Pick the button text.").max(120),
    links: z.array(z.object({ a: url, b: z.string().trim().max(500).optional() })).max(20).default([]),
    fileIds: z.array(z.uuid()).max(50).default([]),
    note: z.string().trim().max(4000).default(""),
  }),
});

export type BriefInput = z.input<typeof briefSchema>;

/** Field-level problems for the form, step by step. Empty when the brief can be sent. */
export function briefProblems(input: { name: string; setup: Partial<CampaignSetup>; brief: Partial<BriefAnswers> }): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  if (!input.name.trim()) out.name = "Give the campaign a name.";
  if (!input.brief.promote?.trim()) out.promote = "Tell us what to promote.";
  if (!input.brief.goal?.trim()) out.goal = "Pick the goal.";
  if (!input.brief.cta?.trim()) out.cta = "Pick the button text.";
  if (input.brief.offer && input.brief.offer !== "No offer" && input.brief.offer !== UP_TO_YOU && !input.brief.offerText?.trim()) {
    out.offerText = "Add the exact wording of the offer.";
  }
  try {
    validateSetup(input.setup);
  } catch (e) {
    if (e instanceof SetupError) out[e.field] = e.message;
  }
  return out;
}

export const STEP_FIELDS: Record<1 | 2, string[]> = {
  1: ["name", "promote", "goal", "cta", "offerText"],
  2: ["kind", "formats", "lengths", "languages"],
};

/** Our defaults where the client said "Up to you" (spec §6.5). */
export const DEFAULT_FORMATS: FormatId[] = ["1x1", "4x5", "9x16", "16x9"];
export const DEFAULT_LENGTH = 10;
export const LENGTHS = [...durations];
