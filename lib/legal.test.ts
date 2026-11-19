import { describe, expect, it } from "vitest";
import { loadLegalDoc } from "./legal";

describe("legal documents", () => {
  it("render the brand and agency variants and hash the exact text", async () => {
    const brand = await loadLegalDoc("nda", false);
    const agency = await loadLegalDoc("nda", true);
    expect(brand.version).toBe("nda.v1");
    expect(brand.title).toBe("Mutual non-disclosure agreement");
    expect(brand.status).toBe("Draft · for the lawyer");
    expect(brand.blocks.find((b) => b.text.startsWith("We don't show your work"))).toBeTruthy();
    expect(agency.blocks.find((b) => b.text.startsWith("We never contact your clients"))).toBeTruthy();
    expect(agency.blocks.find((b) => b.text.startsWith("We don't show your work"))).toBeFalsy();
    expect(brand.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(brand.hash).not.toBe(agency.hash);
    expect((await loadLegalDoc("nda", false)).hash).toBe(brand.hash);
  });
  it("terms pass rights to agency clients only", async () => {
    const t = await loadLegalDoc("terms", true);
    expect(t.blocks.some((b) => b.text.includes("pass these rights to your client"))).toBe(true);
    expect((await loadLegalDoc("terms", false)).blocks.some((b) => b.text.includes("pass these rights"))).toBe(false);
  });
});
