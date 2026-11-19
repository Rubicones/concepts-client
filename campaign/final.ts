import { clientTitle, type GalleryFinal } from "@/lib/forma-map";
import type { FinalSnapshot } from "./types";

/**
 * The final delivery and its downloads (spec §5.2, §6.7, §6.8). Pure: shared by
 * the server, the download panel and the tests.
 */

export const FILE_TYPES = ["mp4", "webm", "gif", "png", "jpg"] as const;
export type FileType = (typeof FILE_TYPES)[number];

export interface ExportFile {
  format: string;
  lang: string;
  /** Seconds; 0 for posters and covers. */
  length: number;
  fileType: FileType;
  size: number | null;
  width: number | null;
  height: number | null;
  status: "pending" | "ready" | "failed";
}

const PATH = /^\/p\/[0-9a-f-]{36}\/[^?#]+$/i;

/** The immutable final snapshot, client-worded, from Forma's final. */
export function buildFinalSnapshot(f: GalleryFinal): { final: FinalSnapshot } {
  if (!f.id || !f.entryId) throw new Error("This campaign has no final yet.");
  if (!PATH.test(f.path)) throw new Error("The final has no valid preview path.");
  if (!f.formats.length) throw new Error("The final has no formats.");
  return {
    final: {
      id: f.id,
      title: clientTitle(f.title) || "Final",
      entryId: f.entryId,
      path: f.path,
      kind: f.kind,
      formats: f.formats,
      langs: f.langs.length ? f.langs : ["en"],
      lengths: f.kind === "poster" ? [] : f.lengths,
    },
  };
}

/* ---------------- Naming ---------------- */

/** One path segment platforms accept: letters, digits, dashes; keeps capitals. */
export function nameSegment(s: string, fallback = "Untitled"): string {
  const out = String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return out || fallback;
}

/** `<Brand>/<Campaign>/<format>/<Brand>_<Campaign>_<format>_<lang>_<length>s.<ext>` (no length for stills). */
export function exportPath(brand: string, campaign: string, f: Pick<ExportFile, "format" | "lang" | "length" | "fileType">): string {
  const b = nameSegment(brand, "Brand");
  const c = nameSegment(campaign, "Campaign");
  const fmt = nameSegment(f.format, "format");
  const parts = [b, c, fmt, nameSegment(f.lang, "xx").toLowerCase()];
  if (f.length > 0) parts.push(`${f.length}s`);
  return `${b}/${c}/${fmt}/${parts.join("_")}.${f.fileType}`;
}

export const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export const fileKey = (f: Pick<ExportFile, "format" | "lang" | "length" | "fileType">) => `${f.format}|${f.lang}|${f.length}|${f.fileType}`;

/* ---------------- What the delivery will contain ---------------- */

/**
 * Every file the final will be exported as: a video per format × language × length
 * and a still per format × language (posters: stills only). Known before Forma
 * renders anything, so the panel can show the whole shape and every filter.
 */
export function expectedExports(final: Pick<FinalSnapshot, "kind" | "formats" | "langs" | "lengths">): ExportFile[] {
  const out: ExportFile[] = [];
  const langs = final.langs.length ? final.langs : ["en"];
  const blank = { size: null, width: null, height: null, status: "pending" as const };
  for (const format of final.formats) {
    for (const lang of langs) {
      if (final.kind !== "poster") for (const length of final.lengths) out.push({ format, lang, length, fileType: "mp4", ...blank });
      out.push({ format, lang, length: 0, fileType: "png", ...blank });
    }
  }
  return out;
}

/** Real export rows win over the expected placeholders; extra rows (other types) are kept. */
export function mergeExports(expected: ExportFile[], actual: ExportFile[]): ExportFile[] {
  const byKey = new Map(actual.map((f) => [fileKey(f), f]));
  const merged = expected.map((f) => byKey.get(fileKey(f)) ?? f);
  const seen = new Set(expected.map(fileKey));
  return [...merged, ...actual.filter((f) => !seen.has(fileKey(f)))];
}

/* ---------------- Selection ---------------- */

export interface Selection {
  /** `${format}|${lang}` cells of the matrix. */
  cells: string[];
  lengths: number[];
  types: FileType[];
}

export const cell = (format: string, lang: string) => `${format}|${lang}`;

export interface ExportShape {
  formats: string[];
  langs: string[];
  lengths: number[];
  types: FileType[];
  /** Cells that have at least one file (ready or on the way). */
  available: Set<string>;
  /** Cells with at least one file ready to download. */
  readyCells: Set<string>;
}

/** What exists, in a stable order: formats and languages as the final lists them, lengths ascending. */
export function shapeOf(files: ExportFile[], order: { formats: string[]; langs: string[] }): ExportShape {
  const live = files.filter((f) => f.status !== "failed");
  const sortBy = (list: string[], pref: string[]) => [...new Set(list)].sort((a, b) => rank(pref, a) - rank(pref, b) || a.localeCompare(b));
  // Only timed files have a length to choose; stills come with their cell and type.
  const lengths = [...new Set(live.map((f) => f.length).filter((n) => n > 0))].sort((a, b) => a - b);
  return {
    formats: sortBy(live.map((f) => f.format), order.formats),
    langs: sortBy(live.map((f) => f.lang), order.langs),
    lengths,
    types: FILE_TYPES.filter((t) => live.some((f) => f.fileType === t)),
    available: new Set(live.map((f) => cell(f.format, f.lang))),
    readyCells: new Set(live.filter((f) => f.status === "ready").map((f) => cell(f.format, f.lang))),
  };
}

function rank(pref: string[], v: string) {
  const i = pref.indexOf(v);
  return i < 0 ? pref.length : i;
}

export type Preset = { kind: "everything" } | { kind: "format"; format: string } | { kind: "lang"; lang: string };

export function presetSelection(shape: ExportShape, p: Preset): Selection {
  const all = { lengths: shape.lengths, types: shape.types };
  const cells = shape.formats.flatMap((f) => shape.langs.map((l) => cell(f, l))).filter((c) => shape.available.has(c));
  if (p.kind === "everything") return { cells, ...all };
  if (p.kind === "format") return { cells: cells.filter((c) => c.startsWith(`${p.format}|`)), ...all };
  return { cells: cells.filter((c) => c.endsWith(`|${p.lang}`)), ...all };
}

/** Which preset the selection equals, if any (so the preset chip stays lit only while true). */
export function matchingPreset(shape: ExportShape, s: Selection): Preset | null {
  const same = (a: Selection) => sameSet(a.cells, s.cells) && sameSet(a.lengths, s.lengths) && sameSet(a.types, s.types);
  if (!s.cells.length) return null;
  if (same(presetSelection(shape, { kind: "everything" }))) return { kind: "everything" };
  for (const format of shape.formats) if (same(presetSelection(shape, { kind: "format", format }))) return { kind: "format", format };
  for (const lang of shape.langs) if (same(presetSelection(shape, { kind: "lang", lang }))) return { kind: "lang", lang };
  return null;
}

function sameSet<T>(a: T[], b: T[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/** Toggle a whole row (format) or column (language): all on if any is off, else all off. */
export function toggleLine(shape: ExportShape, s: Selection, line: { format?: string; lang?: string }): Selection {
  const targets = shape.formats
    .flatMap((f) => shape.langs.map((l) => ({ f, l })))
    .filter(({ f, l }) => (line.format ? f === line.format : true) && (line.lang ? l === line.lang : true))
    .map(({ f, l }) => cell(f, l))
    .filter((c) => shape.available.has(c));
  const on = new Set(s.cells);
  const allOn = targets.every((c) => on.has(c));
  for (const c of targets) {
    if (allOn) on.delete(c);
    else on.add(c);
  }
  return { ...s, cells: [...on] };
}

export function toggleIn<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** The files a selection means (ready or on the way). Stills (length 0) ignore the length filter: a cover is not "10 s". */
export function selectFiles(files: ExportFile[], s: Selection): ExportFile[] {
  const cells = new Set(s.cells);
  const lengths = new Set(s.lengths);
  const types = new Set(s.types);
  return files.filter(
    (f) => f.status !== "failed" && cells.has(cell(f.format, f.lang)) && types.has(f.fileType) && (f.length === 0 || lengths.has(f.length)),
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function summary(files: ExportFile[]): string {
  const bytes = files.reduce((s, f) => s + (f.size ?? 0), 0);
  const known = files.every((f) => f.size !== null);
  const count = `${files.length} file${files.length === 1 ? "" : "s"}`;
  return files.length && bytes ? `${count} · ${known ? "" : "≈ "}${formatBytes(bytes)}` : count;
}
