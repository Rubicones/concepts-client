import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defaultFormats, durations, formats, LANGUAGES } from "./forma-constants";

/**
 * The dashboard copies Forma's formats, durations and languages. This fails the
 * moment they drift. Looks for the Forma repo next to this one (FORMA_DIR overrides).
 */
const formaDir = process.env.FORMA_DIR ?? path.resolve(import.meta.dirname, "../../../forma");
const hasForma = existsSync(path.join(formaDir, "motion.mjs"));

describe.skipIf(!hasForma)("constants match Forma", () => {
  it("formats, default formats and durations", async () => {
    const motion = await import(pathToFileURL(path.join(formaDir, "motion.mjs")).href);
    expect(formats).toEqual(motion.formats);
    expect(defaultFormats).toEqual(motion.defaultFormats);
    expect([...durations]).toEqual(motion.durations);
  });

  it("languages", async () => {
    const langs = await import(pathToFileURL(path.join(formaDir, "shared/languages.mjs")).href);
    expect(LANGUAGES).toEqual(langs.LANGUAGES);
  });
});
