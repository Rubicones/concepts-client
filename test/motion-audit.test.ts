import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Motion audit (spec §2.2), as a test so it stays true:
 *  - feedback 120–200 ms, surfaces and layout 240–420 ms → every duration is within 120–420 ms;
 *  - springs only from lib/motion.ts presets (stiffness ~380, damping ~32);
 *  - no named easings that contradict the prototype's curve.
 * Looping indicators (shimmer, spinners, ambient `repeat: Infinity` illustrations) are not counted.
 */

const ROOT = path.resolve(__dirname, "..");
const DIRS = ["app", "components", "lib", "campaign", "questionnaire"];

function files(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs).flatMap((name) => {
    const p = path.join(abs, name);
    if (statSync(p).isDirectory()) return files(path.join(dir, name));
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path.join(dir, name)] : [];
  });
}

const sources = DIRS.flatMap(files).map((f) => ({ file: f, text: readFileSync(path.join(ROOT, f), "utf8") }));

function hits(re: RegExp) {
  return sources.flatMap(({ file, text }) =>
    [...text.matchAll(re)].map((m) => {
      // The transition object around the match: ambient loops (`repeat: Infinity`) are indicators, not UI motion.
      const start = text.lastIndexOf("{", m.index);
      const end = text.indexOf("}", m.index);
      const loop = /repeat:\s*Infinity/.test(text.slice(start, end));
      return { file, match: m[0], value: m[1], loop };
    }),
  );
}

const report = (list: ReturnType<typeof hits>) => list.map(({ file, match }) => `${file}: ${match}`);

describe("motion audit", () => {
  it("Tailwind durations stay within 120–420 ms", () => {
    const bad = [...hits(/\bduration-(\d+)\b/g), ...hits(/\bduration-\[(\d+)ms\]/g)].filter((h) => {
      const ms = Number(h.value);
      return ms < 120 || ms > 420;
    });
    expect(report(bad)).toEqual([]);
  });

  it("motion durations (seconds) stay within 0.12–0.42 s", () => {
    // `duration: 2500` style values are toast lifetimes in ms, not animation; zero is a state, not a transition.
    const bad = hits(/\bduration:\s*(\d*\.?\d+)\b/g).filter((h) => {
      const s = Number(h.value);
      return !h.loop && s > 0 && s < 5 && (s < 0.12 || s > 0.42);
    });
    expect(report(bad)).toEqual([]);
  });

  it("springs come from the presets in lib/motion.ts", () => {
    const bad = hits(/\bstiffness:\s*(\d+)/g).filter((h) => h.file !== path.join("lib", "motion.ts"));
    expect(report(bad)).toEqual([]);
  });

  it("no easings that fight the prototype's curve", () => {
    const bad = hits(/\bease:\s*"(linear|easeIn|easeInOut|circIn|backIn|backOut|anticipate)"/g).filter((h) => !h.loop);
    expect(report(bad)).toEqual([]);
  });

  it("reduced motion is handled globally", () => {
    const css = sources.find((s) => s.file === path.join("app", "globals.css"))!.text;
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    const providers = sources.find((s) => s.file === path.join("app", "providers.tsx"))!.text;
    expect(providers).toMatch(/reducedMotion="user"/);
  });
});
