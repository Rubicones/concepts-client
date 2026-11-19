import { describe, expect, it } from "vitest";
import { buildDirectionsSnapshot, commentsFor, type CommentView } from "./review";
import type { GalleryDirection } from "@/lib/forma-map";

const P = "6f1a3c6e-8a0b-4a49-9b8e-6f6c9b6f6a01";
const dir = (id: string, title = id): GalleryDirection => ({
  id,
  title,
  idea: "Bold: An idea",
  path: `/p/${P}/${id}.html`,
  format: "9x16",
  lang: "en",
  scenes: ["s1"],
  keyframeSvg: "<svg/>",
});

describe("directions snapshot builder", () => {
  const all = [dir("v1", "Native: Morning Light"), dir("v2"), dir("v3"), dir("v4")];

  it("keeps the picked three in order, client-worded", () => {
    const s = buildDirectionsSnapshot(all, ["v3", "v1", "v2"], { v1: " Warmer than usual " });
    expect(s.directions.map((d) => d.id)).toEqual(["v3", "v1", "v2"]);
    expect(s.directions[1]).toMatchObject({ title: "Morning Light", idea: "An idea", studioNote: "Warmer than usual", path: `/p/${P}/v1.html`, scenes: ["s1"] });
    expect(s.directions[0].studioNote).toBeUndefined();
    expect(JSON.stringify(s)).not.toMatch(/Native:|Bold:/);
  });

  it("refuses anything but three distinct directions with previews", () => {
    expect(() => buildDirectionsSnapshot(all, ["v1", "v2"])).toThrow("exactly three");
    expect(() => buildDirectionsSnapshot(all, ["v1", "v1", "v2"])).toThrow("exactly three");
    expect(() => buildDirectionsSnapshot(all, ["v1", "v2", "nope"])).toThrow("no preview");
    expect(() => buildDirectionsSnapshot([...all, { ...dir("bad"), path: "https://evil.example/x.html" }], ["v1", "v2", "bad"])).toThrow("valid preview path");
  });
});

describe("comment numbering", () => {
  const c = (id: string, item: string, number: number, pin = true): CommentView => ({
    id,
    deliveryId: "d",
    itemId: item,
    scene: null,
    format: null,
    lang: null,
    x: pin ? 0.5 : null,
    y: pin ? 0.5 : null,
    number,
    body: id,
    state: "draft",
    createdAt: `2026-11-19T10:00:0${number}Z`,
  });

  it("numbers pins 1…n per direction without gaps, general comments apart", () => {
    const all = [c("a", "v1", 1), c("b", "v1", 4), c("g", "v1", 2, false), c("x", "v2", 1)];
    const r = commentsFor(all, "v1");
    expect(r.pins.map((p) => [p.id, p.n])).toEqual([["a", 1], ["b", 2]]);
    expect(r.general.map((g) => g.id)).toEqual(["g"]);
    expect(commentsFor(all, "v2").pins[0].n).toBe(1);
  });
});
