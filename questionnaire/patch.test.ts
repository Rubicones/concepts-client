import { describe, expect, it } from "vitest";
import { applyPatch, LockedError, normalizeState, patchSchema } from "./patch";
import { blankState } from "./logic";

const base = () => ({ ...blankState(), role: "brand" as const, a: { c_company: "Kite", c_size: "1–10" }, flags: { c_size: "file" as const } });

describe("autosave patches", () => {
  it("validates keys and values", () => {
    expect(patchSchema.safeParse({ a: { c_company: "Kite", "c1:c_what": "x", v_pairs: { warm: 3, tone: "decide" } } }).success).toBe(true);
    expect(patchSchema.safeParse({ a: { "../x": "y" } }).success).toBe(false);
    expect(patchSchema.safeParse({ a: { c_company: "x".repeat(5000) } }).success).toBe(false);
    expect(patchSchema.safeParse({ meta: { legal: { nda: { by: "me" } } } }).success).toBe(false);
    expect(patchSchema.safeParse({ a: { p_list: [{ a: "A", evil: 1 }] } }).success).toBe(false);
  });

  it("sets, clears and drops the check flag of what changed", () => {
    const s = applyPatch(base(), { a: { c_size: "11–50", c_company: null } }, null);
    expect(s.a).toEqual({ c_size: "11–50" });
    expect(s.flags.c_size).toBeUndefined();
  });

  it("sets flags from imports", () => {
    expect(applyPatch(base(), { a: { c_what: "Apps" }, flags: { c_what: "file" } }, null).flags.c_what).toBe("file");
  });

  it("removing a client removes its answers", () => {
    const s = { ...base(), role: "agency" as const, clients: [{ id: "c1" }, { id: "c2" }], a: { "c1:c_company": "A", "c2:c_company": "B", g_name: "Agency" } };
    const next = applyPatch(s, { meta: { clients: [{ id: "c1" }] } }, null);
    expect(next.a).toEqual({ "c1:c_company": "A", g_name: "Agency" });
  });

  it("never touches signatures", () => {
    const sig = { by: "Ana", company: "Kite", at: "t", docVersion: "nda.v1", documentHash: "h", userAgent: null };
    const s = { ...base(), legal: { nda: sig } };
    expect(applyPatch(s, { meta: { legal: { name: "Bob" } } }, null).legal).toEqual({ nda: sig, name: "Bob" });
  });

  it("only unlocked answers change while questions are open", () => {
    expect(applyPatch(base(), { a: { c_what: "New" } }, ["c_what"]).a.c_what).toBe("New");
    expect(() => applyPatch(base(), { a: { c_size: "200" } }, ["c_what"])).toThrow(LockedError);
    expect(() => applyPatch(base(), { meta: { role: "agency" } }, ["c_what"])).toThrow(LockedError);
  });

  it("normalizes odd stored states", () => {
    expect(normalizeState(null)).toEqual(blankState());
    expect(normalizeState({ role: "x", clients: [] }).clients).toEqual([{ id: "c1" }]);
  });
});
