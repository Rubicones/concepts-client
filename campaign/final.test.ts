import { describe, expect, it } from "vitest";
import {
  buildFinalSnapshot,
  cell,
  expectedExports,
  exportPath,
  formatBytes,
  matchingPreset,
  mergeExports,
  nameSegment,
  presetSelection,
  selectFiles,
  shapeOf,
  summary,
  toggleLine,
  type ExportFile,
} from "./final";
import type { GalleryFinal } from "@/lib/forma-map";

const P = "6f1a3c6e-8a0b-4a49-9b8e-6f6c9b6f6a01";

const f = (format: string, lang: string, length: number, fileType: ExportFile["fileType"], size = 1000, status: ExportFile["status"] = "ready"): ExportFile => ({
  format,
  lang,
  length,
  fileType,
  size,
  width: null,
  height: null,
  status,
});

const FILES: ExportFile[] = [
  f("9x16", "en", 10, "mp4", 2_000_000),
  f("9x16", "en", 15, "mp4", 3_000_000),
  f("9x16", "de", 10, "mp4"),
  f("9x16", "de", 15, "mp4"),
  f("1x1", "en", 10, "mp4"),
  f("1x1", "en", 15, "mp4"),
  f("9x16", "en", 0, "png"),
  f("1x1", "en", 0, "png"),
  f("1x1", "de", 10, "mp4", 1000, "pending"),
];

describe("final snapshot", () => {
  const final: GalleryFinal = { id: "v1", title: "Native: Morning Light", entryId: "e1", path: `/p/${P}/f.html`, kind: "multi", formats: ["9x16"], langs: [], lengths: [10], keyframeSvg: "<svg/>" };
  it("is client-worded and complete", () => {
    expect(buildFinalSnapshot(final).final).toEqual({ id: "v1", title: "Morning Light", entryId: "e1", path: `/p/${P}/f.html`, kind: "multi", formats: ["9x16"], langs: ["en"], lengths: [10] });
  });
  it("drops lengths for posters and refuses broken finals", () => {
    expect(buildFinalSnapshot({ ...final, kind: "poster" }).final.lengths).toEqual([]);
    expect(() => buildFinalSnapshot({ ...final, path: "https://x.example/f.html" })).toThrow("valid preview path");
    expect(() => buildFinalSnapshot({ ...final, formats: [] })).toThrow("no formats");
  });
});

describe("export naming", () => {
  it("follows Brand/Campaign/format/Brand_Campaign_format_lang_length.ext", () => {
    expect(exportPath("Café Noir", "Spring Sale 2027!", { format: "9x16", lang: "DE", length: 15, fileType: "mp4" })).toBe(
      "Cafe-Noir/Spring-Sale-2027/9x16/Cafe-Noir_Spring-Sale-2027_9x16_de_15s.mp4",
    );
  });
  it("leaves the length off stills and survives empty names", () => {
    expect(exportPath("", "  ", { format: "1x1", lang: "en", length: 0, fileType: "png" })).toBe("Brand/Campaign/1x1/Brand_Campaign_1x1_en.png");
    expect(nameSegment("Tom & Jerry / Co.")).toBe("Tom-and-Jerry-Co");
  });
});

describe("selection", () => {
  const shape = shapeOf(FILES, { formats: ["1x1", "9x16"], langs: ["en", "de"] });

  it("knows the shape of what is ready", () => {
    expect(shape.formats).toEqual(["1x1", "9x16"]);
    expect(shape.langs).toEqual(["en", "de"]);
    expect(shape.lengths).toEqual([10, 15]);
    expect(shape.types).toEqual(["mp4", "png"]);
    expect(shape.available.has(cell("1x1", "de"))).toBe(true); // a file on the way still has a cell
    expect(shape.readyCells.has(cell("1x1", "de"))).toBe(false);
  });

  it("presets select what they say", () => {
    const all = selectFiles(FILES, presetSelection(shape, { kind: "everything" }));
    expect(all).toHaveLength(9);
    expect(all.filter((f) => f.status === "ready")).toHaveLength(8);
    expect(selectFiles(FILES, presetSelection(shape, { kind: "format", format: "9x16" }))).toHaveLength(5);
    expect(selectFiles(FILES, presetSelection(shape, { kind: "lang", lang: "de" }))).toHaveLength(3);
  });

  it("filters by length and type; stills ignore the length", () => {
    const s = { ...presetSelection(shape, { kind: "everything" }), lengths: [10] };
    const out = selectFiles(FILES, s);
    expect(out.filter((x) => x.fileType === "mp4").every((x) => x.length === 10)).toBe(true);
    expect(out.filter((x) => x.fileType === "png")).toHaveLength(2);
    expect(selectFiles(FILES, { ...s, types: ["png"] })).toHaveLength(2);
  });

  it("toggles whole rows and columns, and recognises presets", () => {
    const none = { cells: [], lengths: shape.lengths, types: shape.types };
    const row = toggleLine(shape, none, { format: "9x16" });
    expect(row.cells.sort()).toEqual(["9x16|de", "9x16|en"]);
    expect(matchingPreset(shape, row)).toEqual({ kind: "format", format: "9x16" });
    expect(toggleLine(shape, row, { format: "9x16" }).cells).toEqual([]);
    const col = toggleLine(shape, none, { lang: "en" });
    expect(col.cells.sort()).toEqual(["1x1|en", "9x16|en"]);
    expect(toggleLine(shape, none, { lang: "de" }).cells.sort()).toEqual(["1x1|de", "9x16|de"]);
    expect(matchingPreset(shape, toggleLine(shape, col, { lang: "de" }))).toEqual({ kind: "everything" });
  });

  it("summarises count and size", () => {
    expect(summary(FILES.slice(0, 2))).toBe("2 files · 4.8 MB");
    expect(summary([])).toBe("0 files");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("2 KB");
  });
});

describe("expected exports", () => {
  it("lists a video per format × language × length and a still per format × language", () => {
    const e = expectedExports({ kind: "multi", formats: ["9x16", "1x1"], langs: ["en", "de"], lengths: [10, 15] });
    expect(e).toHaveLength(2 * 2 * 2 + 2 * 2);
    expect(e.every((f) => f.status === "pending")).toBe(true);
    expect(expectedExports({ kind: "poster", formats: ["1x1"], langs: ["en"], lengths: [] })).toEqual([
      { format: "1x1", lang: "en", length: 0, fileType: "png", size: null, width: null, height: null, status: "pending" },
    ]);
  });
  it("real rows replace placeholders; extra rows stay", () => {
    const e = expectedExports({ kind: "single", formats: ["1x1"], langs: ["en"], lengths: [10] });
    const merged = mergeExports(e, [f("1x1", "en", 10, "mp4", 500), f("1x1", "en", 0, "jpg", 10)]);
    expect(merged.map((x) => `${x.fileType}:${x.status}`)).toEqual(["mp4:ready", "png:pending", "jpg:ready"]);
  });
});
