import { describe, expect, it } from "vitest";
import { cardFormat, clientTitle, latestBrandVersions, toGalleryCampaign, toSummary, variantsOf, type OutputsById, type RawCampaignRow } from "./forma-map";

const B = "6f1a3c6e-8a0b-4a49-9b8e-6f6c9b6f6a01";
const C = "7f1a3c6e-8a0b-4a49-9b8e-6f6c9b6f6a02";

const styles = {
  styles: [
    { name: "Native: Morning Light", idea: "Soft daylight on the product", svg: "<svg id='a'/>" },
    { name: "World: Paper City", idea: "Bold: Cut-paper streets", svg: "<svg id='b'/>" },
  ],
};

const outputs: OutputsById = new Map<string, Record<string, unknown> | null>([
  ["st1", styles],
  ["pv1", { path: `/p/${B}/a.html`, format: "9x16", lang: "de", scenes: ["s1", "s2"] }],
  ["pv2", { path: `/p/${B}/b.html`, format: "9x16", lang: "de", scenes: [] }],
  ["fn2", { path: `/p/${B}/f.html`, stage: "final", kind: "multi", formats: ["9x16", "1x1"], langs: ["de", "en"], lengths: [10, 15] }],
]);

const row: RawCampaignRow = {
  id: C,
  status: null,
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-02T10:00:00Z",
  name: "Spring launch",
  setup: { kind: "multi", formats: ["9x16", "1x1"], languages: ["de", "en"], lengths: [10, 15] },
  variants: [
    { id: "v1", label: "Style 1", styles: { entryId: "st1", chosenIndex: 0 }, preview: { entryId: "pv1" } },
    { id: "v2", label: "Style 2", styles: { entryId: "st1", chosenIndex: 1 }, preview: { entryId: "pv2" }, final: { entryId: "fn2" } },
    { id: "v3", label: "Style 3", styles: { entryId: "st1", chosenIndex: null } },
  ],
  active: "v2",
  steps: null,
};

describe("Forma → client mapping", () => {
  it("strips internal prefixes from titles", () => {
    expect(clientTitle("Native: Morning Light")).toBe("Morning Light");
    expect(clientTitle("bold —  Big  type")).toBe("Big type");
    expect(clientTitle("Worldwide warmth")).toBe("Worldwide warmth");
  });

  it("turns variants with previews into directions, client-worded", () => {
    const c = toGalleryCampaign(row, outputs);
    expect(c.directions.map((d) => d.title)).toEqual(["Morning Light", "Paper City"]);
    expect(c.directions[1].idea).toBe("Cut-paper streets");
    expect(c.directions[0]).toMatchObject({ format: "9x16", lang: "de", scenes: ["s1", "s2"], keyframeSvg: "<svg id='a'/>" });
    for (const d of c.directions) expect(d.title).not.toMatch(/style \d|native|world/i);
  });

  it("shows the active variant's final with its formats, languages and lengths", () => {
    const c = toGalleryCampaign(row, outputs);
    expect(c.final).toMatchObject({ id: "v2", title: "Paper City", kind: "multi", formats: ["9x16", "1x1"], langs: ["de", "en"], lengths: [10, 15] });
    expect(c.cover).toBe("<svg id='b'/>");
  });

  it("falls back to another variant's final when the active one has none", () => {
    const c = toGalleryCampaign({ ...row, active: "v1" }, outputs);
    expect(c.final?.id).toBe("v2");
  });

  it("names unnamed directions plainly", () => {
    const c = toGalleryCampaign({ ...row, variants: [{ id: "x", label: "Style 4", preview: { entryId: "pv1" } }] }, outputs);
    expect(c.directions[0].title).toBe("Direction 1");
  });

  it("upgrades old single-style docs", () => {
    const legacy = { id: C, variants: null, steps: { preview: { entryId: "pv1" }, styles: { entryId: "st1", chosenIndex: 0 } } };
    expect(variantsOf(legacy)).toHaveLength(1);
    expect(toGalleryCampaign({ ...row, ...legacy }, outputs).directions[0].title).toBe("Morning Light");
  });

  it("summarises for cards", () => {
    expect(toSummary(row, outputs)).toMatchObject({ directionCount: 2, hasFinal: true, cover: "<svg id='b'/>", kind: "multi" });
  });

  it("puts the final on the card, in the format that fits a 4:3 tile", () => {
    expect(toSummary(row, outputs).final).toEqual({ path: `/p/${B}/f.html`, format: "1x1", lang: "de", length: 10 });
    expect(toSummary({ ...row, variants: row.variants!.map((v) => ({ ...v, final: undefined })) }, outputs).final).toBeNull();
    expect(cardFormat(["9x16", "16x9", "5x4"])).toBe("5x4");
    expect(cardFormat([])).toBeNull();
  });

  it("finds the latest brand manifest version", () => {
    const m = latestBrandVersions([`brands/versions/${B}/1.json`, `brands/versions/${B}/12.json`, `brands/versions/${B}/3.json`, "brands/versions/x/9.json", `brands/files/abc`]);
    expect(m.get(B)).toBe(12);
    expect(m.size).toBe(1);
  });
});
