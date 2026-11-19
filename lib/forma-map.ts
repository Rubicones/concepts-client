/**
 * Pure mapping from Forma's data (campaign docs, history entries, brand manifests)
 * to what a client sees. Mirrors forma/campaigns.mjs `upgradeCampaign` +
 * `hydrateCampaign` for the fields we need, and never lets pipeline words
 * ("Style 2", "Native: …", entry ids) reach a title.
 */

export interface RawVariant {
  id?: string;
  label?: string;
  styles?: { entryId?: string | null; chosenIndex?: number | null; direction?: string } | null;
  preview?: { entryId?: string | null; approvedAt?: string | null; stale?: boolean } | null;
  final?: { entryId?: string | null; stale?: boolean } | null;
}

export interface RawCampaignRow {
  id: string;
  status: string | null;
  updated_at: string;
  created_at: string;
  name: string | null;
  setup: { kind?: string; formats?: string[]; languages?: string[]; lengths?: number[] } | null;
  variants: RawVariant[] | null;
  active: string | null;
  steps: { styles?: RawVariant["styles"]; preview?: RawVariant["preview"]; final?: RawVariant["final"] } | null;
}

export interface StyleOption {
  name?: string;
  idea?: string;
  direction?: string;
  svg?: string;
}

/** `entries.doc->output` by entry id. */
export type OutputsById = Map<string, Record<string, unknown> | null>;

export type CampaignKind = "poster" | "single" | "multi";

export interface GalleryDirection {
  id: string;
  title: string;
  idea: string;
  path: string;
  format: string;
  lang: string;
  scenes: string[];
  keyframeSvg: string | null;
}

export interface GalleryFinal {
  id: string;
  title: string;
  entryId: string;
  path: string;
  kind: CampaignKind;
  formats: string[];
  langs: string[];
  lengths: number[];
  keyframeSvg: string | null;
}

export interface GalleryCampaign {
  id: string;
  name: string;
  kind: CampaignKind;
  formats: string[];
  langs: string[];
  lengths: number[];
  updatedAt: string;
  archived: boolean;
  directions: GalleryDirection[];
  final: GalleryFinal | null;
  cover: string | null;
}

/** What a campaign card plays when the campaign has a final: frame 0 of one format (Forma's own thumbnail rule). */
export interface CardFinal {
  path: string;
  format: string;
  lang: string;
  length: number | null;
}

export interface GalleryCampaignSummary {
  id: string;
  name: string;
  kind: CampaignKind;
  formats: string[];
  langs: string[];
  updatedAt: string;
  archived: boolean;
  directionCount: number;
  hasFinal: boolean;
  cover: string | null;
  /** Set when a final exists: the card shows it instead of the style keyframe. */
  final: CardFinal | null;
}

const asKind = (k: unknown): CampaignKind => (k === "poster" || k === "single" || k === "multi" ? k : "single");
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const numbers = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n) && n > 0) : []);

/** Strips Forma's internal direction prefixes ("Native: ", "World: ", "Bold: ") and tidies spacing. */
export function clientTitle(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/^\s*(native|world|bold)\s*[:·—–-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Variants of a campaign doc, including old single-style docs (upgradeCampaign). */
export function variantsOf(row: Pick<RawCampaignRow, "id" | "variants" | "steps">): (RawVariant & { id: string })[] {
  if (Array.isArray(row.variants) && row.variants.length) {
    return row.variants.map((v, i) => ({ ...v, id: v.id || `${row.id}:v${i + 1}` }));
  }
  const s = row.steps ?? {};
  if (!s.styles?.entryId && !s.preview?.entryId && !s.final?.entryId) return [];
  return [{ id: `${row.id}:v1`, label: "Style 1", styles: s.styles, preview: s.preview, final: s.final }];
}

export function chosenStyle(v: RawVariant, outputs: OutputsById): StyleOption | null {
  const entryId = v.styles?.entryId;
  const idx = v.styles?.chosenIndex;
  if (!entryId || idx === null || idx === undefined) return null;
  const styles = outputs.get(entryId)?.styles;
  return Array.isArray(styles) ? ((styles[idx] as StyleOption | undefined) ?? null) : null;
}

const isDefaultLabel = (label: string | undefined) => !label || /^style\s*\d+$/i.test(label.trim());

function titleOf(v: RawVariant, outputs: OutputsById, index: number): string {
  const style = chosenStyle(v, outputs);
  const fromStyle = clientTitle(style?.name);
  if (fromStyle) return fromStyle;
  if (!isDefaultLabel(v.label)) return clientTitle(v.label);
  return `Direction ${index + 1}`;
}

/** Every entry id a campaign's variants point at (to fetch in one query). */
export function referencedEntryIds(row: Pick<RawCampaignRow, "id" | "variants" | "steps">): string[] {
  const ids = new Set<string>();
  for (const v of variantsOf(row)) {
    for (const id of [v.styles?.entryId, v.preview?.entryId, v.final?.entryId]) if (id) ids.add(id);
  }
  return [...ids];
}

export function toGalleryCampaign(row: RawCampaignRow, outputs: OutputsById): GalleryCampaign {
  const variants = variantsOf(row);
  const setup = row.setup ?? {};
  const kind = asKind(setup.kind);
  const formats = strings(setup.formats);
  const langs = strings(setup.languages);

  const directions: GalleryDirection[] = [];
  variants.forEach((v, i) => {
    const out = v.preview?.entryId ? outputs.get(v.preview.entryId) : null;
    const path = typeof out?.path === "string" ? out.path : null;
    if (!path) return;
    const style = chosenStyle(v, outputs);
    directions.push({
      id: v.id,
      title: titleOf(v, outputs, i),
      idea: clientTitle(style?.idea),
      path,
      format: typeof out?.format === "string" ? out.format : formats[0] ?? "1x1",
      lang: typeof out?.lang === "string" ? out.lang : langs[0] ?? "en",
      scenes: strings(out?.scenes),
      keyframeSvg: style?.svg ?? null,
    });
  });

  // The active variant's final; if it has none, the first variant that does.
  const ordered = [...variants].sort((a, b) => Number(b.id === row.active) - Number(a.id === row.active));
  let final: GalleryFinal | null = null;
  for (const v of ordered) {
    const entryId = v.final?.entryId;
    const out = entryId ? outputs.get(entryId) : null;
    if (!entryId || typeof out?.path !== "string") continue;
    const style = chosenStyle(v, outputs);
    const finalKind = asKind(out.kind ?? setup.kind);
    final = {
      id: v.id,
      title: titleOf(v, outputs, variants.indexOf(v)),
      entryId,
      path: out.path,
      kind: finalKind,
      formats: strings(out.formats).length ? strings(out.formats) : formats,
      langs: strings(out.langs).length ? strings(out.langs) : langs,
      lengths: finalKind === "poster" ? [] : numbers(out.lengths).length ? numbers(out.lengths) : numbers(setup.lengths),
      keyframeSvg: style?.svg ?? null,
    };
    break;
  }

  const activeVariant = variants.find((v) => v.id === row.active) ?? variants[0];
  const cover = (activeVariant && chosenStyle(activeVariant, outputs)?.svg) || directions[0]?.keyframeSvg || null;

  return {
    id: row.id,
    name: clientTitle(row.name) || "Untitled campaign",
    kind,
    formats,
    langs,
    lengths: numbers(setup.lengths),
    updatedAt: row.updated_at || row.created_at,
    archived: row.status === "archived",
    directions,
    final,
    cover,
  };
}

/** The variant whose final the client sees: the active one, else the first with a final. */
export function finalVariant(row: Pick<RawCampaignRow, "id" | "variants" | "steps" | "active">) {
  const variants = variantsOf(row);
  return [...variants].sort((a, b) => Number(b.id === row.active) - Number(a.id === row.active)).find((v) => v.final?.entryId) ?? null;
}

/** The format that sits best in a 4:3 card (closest ratio), so the final fills the tile. */
export function cardFormat(formats: string[]): string | null {
  if (!formats.length) return null;
  const target = Math.log(4 / 3);
  const ratio = (f: string) => {
    const m = /^(\d+)x(\d+)$/.exec(f);
    return m ? Number(m[1]) / Number(m[2]) : 1;
  };
  return [...formats].sort((a, b) => Math.abs(Math.log(ratio(a)) - target) - Math.abs(Math.log(ratio(b)) - target))[0];
}

export function toSummary(row: RawCampaignRow, outputs: OutputsById): GalleryCampaignSummary {
  const variants = variantsOf(row);
  const active = variants.find((v) => v.id === row.active) ?? variants[0];
  const setup = row.setup ?? {};
  const fv = finalVariant(row);
  const out = fv?.final?.entryId ? outputs.get(fv.final.entryId) : null;
  const finalFormats = strings(out?.formats).length ? strings(out?.formats) : strings(setup.formats);
  const kind = asKind(out?.kind ?? setup.kind);
  const final: CardFinal | null =
    out && typeof out.path === "string"
      ? {
          path: out.path,
          format: cardFormat(finalFormats) ?? "1x1",
          lang: strings(out.langs)[0] ?? strings(setup.languages)[0] ?? "en",
          length: kind === "poster" ? null : (numbers(out.lengths)[0] ?? numbers(setup.lengths)[0] ?? null),
        }
      : null;
  return {
    id: row.id,
    name: clientTitle(row.name) || "Untitled campaign",
    kind: asKind(setup.kind),
    formats: strings(setup.formats),
    langs: strings(setup.languages),
    updatedAt: row.updated_at || row.created_at,
    archived: row.status === "archived",
    directionCount: variants.filter((v) => v.preview?.entryId).length,
    hasFinal: variants.some((v) => v.final?.entryId),
    cover: (fv && chosenStyle(fv, outputs)?.svg) || (active && chosenStyle(active, outputs)?.svg) || null,
    final,
  };
}

/** brands/versions/<id>/<n>.json → latest n per brand (forma/brands.mjs latestVersions). */
export function latestBrandVersions(keys: string[]): Map<string, number> {
  const latest = new Map<string, number>();
  const re = /^brands\/versions\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/(\d+)\.json$/;
  for (const key of keys) {
    const m = re.exec(key);
    if (!m) continue;
    const v = Number(m[2]);
    if (v > (latest.get(m[1]) ?? 0)) latest.set(m[1], v);
  }
  return latest;
}

export const KIND_LABEL: Record<CampaignKind, string> = {
  poster: "Static poster",
  single: "Single-scene video",
  multi: "Multi-scene video",
};
