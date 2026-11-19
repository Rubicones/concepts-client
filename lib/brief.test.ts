import { describe, expect, it } from "vitest";
import { briefProblems, SetupError, validateSetup } from "./brief";
import { prefillBrief } from "@/questionnaire/prefill";
import { blankState, type QState } from "@/questionnaire/logic";

const err = (raw: unknown) => {
  try {
    validateSetup(raw);
    return null;
  } catch (e) {
    return e instanceof SetupError ? e : null;
  }
};

describe("setup validation mirrors Forma's validateSetup", () => {
  it("accepts a valid setup and dedupes", () => {
    expect(validateSetup({ kind: "multi", formats: ["9x16", "9x16", "1x1"], languages: ["en", " de "], lengths: [10, "15"] })).toEqual({
      kind: "multi",
      formats: ["9x16", "1x1"],
      languages: ["en", "de"],
      lengths: [10, 15],
    });
  });
  it("posters need no lengths", () => {
    expect(validateSetup({ kind: "poster", formats: ["1x1"], languages: ["en"], lengths: [99] }).lengths).toEqual([]);
  });
  it("uses Forma's messages", () => {
    expect(err({ kind: "gif" })?.message).toBe("Choose a poster, single-scene video or multi-scene video.");
    expect(err({ kind: "multi", languages: [] })?.message).toBe("Select at least one campaign language.");
    expect(err({ kind: "multi", languages: ["en"], lengths: [3] })?.message).toBe("Choose lengths between 4 and 60 seconds for a multi-scene video.");
    expect(err({ kind: "single", languages: ["en"], lengths: [1] })?.message).toBe("Choose lengths between 2 and 60 seconds for a single-scene video.");
    expect(err({ kind: "single", languages: ["en"], lengths: [2], formats: [] })?.message).toBe("Select at least one format from the list.");
    expect(err({ kind: "single", languages: ["en"], lengths: [2], formats: ["3x2"] })?.field).toBe("formats");
  });
  it("accepts BCP-47-looking codes Forma accepts", () => {
    expect(err({ kind: "poster", languages: ["pt-BR"], formats: ["1x1"] })).toBeNull();
    expect(err({ kind: "poster", languages: ["English"], formats: ["1x1"] })?.field).toBe("languages");
  });
  it("lists field problems for the form", () => {
    const p = briefProblems({ name: "", setup: { kind: "multi", formats: [], languages: ["en"], lengths: [10] }, brief: { offer: "Discount" } });
    expect(Object.keys(p).sort()).toEqual(["cta", "formats", "goal", "name", "offerText", "promote"]);
  });
});

const q = (a: Record<string, unknown>, role: "brand" | "agency" = "brand"): QState => ({ ...blankState(), role, a });

describe("prefill from the questionnaire", () => {
  it("takes starred products, goals, offer, CTA and what we'll make", () => {
    const p = prefillBrief(
      q({
        p_list: [{ a: "Saver" }, { a: "Pots", s: true }],
        d_next: "Spring sale",
        d_goals: ["New customers", "Get known"],
        d_main: "Get known",
        k_offer: "Discount",
        k_cta: ["Sign up", "Download"],
        k_what: ["Video ads"],
        k_formats: ["Vertical 9:16", "Square 1:1"],
        k_len: ["6 s", "15 s", "30 s"],
        k_langs: ["English", "German", "Chinese (Simplified)"],
      }),
      null,
    );
    expect(p.products).toEqual(["Pots", "Saver"]);
    expect(p.brief).toMatchObject({ product: "Pots", promote: "Spring sale", goal: "Get known", offer: "Discount", cta: "Sign up" });
    expect(p.goals.slice(0, 2)).toEqual(["New customers", "Get known"]);
    expect(p.setup).toEqual({ kind: "multi", formats: ["9x16", "1x1"], lengths: [6, 15], languages: ["en", "de", "zh"] });
  });

  it("turns Up to you into our defaults", () => {
    const p = prefillBrief(q({ k_what: ["Up to you"], k_formats: ["Up to you"], k_len: ["Up to you"], k_cta: ["Up to you"] }), null);
    expect(p.setup.formats).toEqual(["1x1", "4x5", "9x16", "16x9"]);
    expect(p.setup.lengths).toEqual([10]);
    expect(p.brief.cta).toBe("Up to you");
  });

  it("static only means a poster", () => {
    expect(prefillBrief(q({ k_what: ["Static ads", "Banners"] }), null).setup).toMatchObject({ kind: "poster", lengths: [] });
  });

  it("falls back to customer languages, then English", () => {
    expect(prefillBrief(q({ c_langs: ["Spanish"] }), null).setup.languages).toEqual(["es"]);
    expect(prefillBrief(q({}), null).setup.languages).toEqual(["en"]);
  });

  it("reads an agency client's own answers", () => {
    const p = prefillBrief(q({ "c2:d_next": "Launch", d_next: "Agency thing" }, "agency"), "c2");
    expect(p.brief.promote).toBe("Launch");
  });

  it("a prefilled brief passes Forma's setup rules", () => {
    expect(() => validateSetup(prefillBrief(q({}), null).setup)).not.toThrow();
  });
});
