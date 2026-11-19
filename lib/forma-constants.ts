/**
 * Constants shared with Forma Studio. Copied from forma/motion.mjs and
 * forma/shared/languages.mjs; `forma-constants.test.ts` fails if they drift.
 */

export interface FormatInfo {
  id: string;
  label: string;
  name: string;
  w: number;
  h: number;
  safe: { top: number; bottom: number; left: number; right: number };
}

export const formats = {
  "1x1": { id: "1x1", label: "1:1", name: "Post", w: 1080, h: 1080, safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 } },
  "4x5": { id: "4x5", label: "4:5", name: "Feed", w: 1080, h: 1350, safe: { top: 0.05, bottom: 0.06, left: 0.05, right: 0.05 } },
  "9x16": { id: "9x16", label: "9:16", name: "Reels / Stories", w: 1080, h: 1920, safe: { top: 0.13, bottom: 0.2, left: 0.06, right: 0.12 } },
  "16x9": { id: "16x9", label: "16:9", name: "Pre-roll / YouTube", w: 1920, h: 1080, safe: { top: 0.06, bottom: 0.1, left: 0.05, right: 0.05 } },
  "5x4": { id: "5x4", label: "5:4", name: "Landscape post", w: 1350, h: 1080, safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 } },
  "191x1": { id: "191x1", label: "1.91:1", name: "Link / Display", w: 1200, h: 628, safe: { top: 0.06, bottom: 0.06, left: 0.04, right: 0.04 } },
} as const satisfies Record<string, FormatInfo>;

export type FormatId = keyof typeof formats;
export const formatIds = Object.keys(formats) as FormatId[];
export const defaultFormats: FormatId[] = ["1x1", "4x5", "9x16", "16x9"];
export const durations = [6, 8, 10, 12, 15] as const;

export const isFormatId = (v: unknown): v is FormatId => typeof v === "string" && Object.hasOwn(formats, v);

/** Format info for any id, falling back to square for unknown ids (old data). */
export function formatInfo(id: string | null | undefined): FormatInfo {
  return isFormatId(id) ? formats[id] : formats["1x1"];
}

export interface LanguageInfo {
  code: string;
  name: string;
  dir?: "rtl";
  cjk?: true;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "ru", name: "Russian" }, { code: "en", name: "English" }, { code: "sr-Latn", name: "Serbian (Latin)" },
  { code: "sr-Cyrl", name: "Serbian (Cyrillic)" }, { code: "uk", name: "Ukrainian" }, { code: "de", name: "German" },
  { code: "fr", name: "French" }, { code: "es", name: "Spanish" }, { code: "it", name: "Italian" }, { code: "pt", name: "Portuguese" },
  { code: "pl", name: "Polish" }, { code: "tr", name: "Turkish" }, { code: "nl", name: "Dutch" }, { code: "kk", name: "Kazakh" },
  { code: "ar", name: "Arabic", dir: "rtl" }, { code: "he", name: "Hebrew", dir: "rtl" },
  { code: "zh", name: "Chinese", cjk: true }, { code: "ja", name: "Japanese", cjk: true }, { code: "ko", name: "Korean", cjk: true },
];

export const language = (code: string): LanguageInfo => LANGUAGES.find((l) => l.code === code) ?? { code, name: code };
