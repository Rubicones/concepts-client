import { describe, expect, it } from "vitest";
import { hintScript, injectIntoHtml, parseHints, renderScaleFor, shouldRerender } from "./render-hints";
import { servePlayerFile, type ObjectReader } from "./serve";

const P = "6f1a3c6e-8a0b-4a49-9b8e-6f6c9b6f6a01";

describe("render hints", () => {
  it("picks the smallest render scale that covers the screen", () => {
    expect(renderScaleFor(0.24, 2)).toBe(0.5); // a wall tile on retina
    expect(renderScaleFor(0.6, 2)).toBe(1.5);
    expect(renderScaleFor(0.1, 1)).toBe(0.25);
    expect(renderScaleFor(3, 3)).toBe(2); // never above 2
  });

  it("re-renders up at once, down only when twice too big", () => {
    expect(shouldRerender(null, 0.5)).toBe(true);
    expect(shouldRerender(0.5, 0.75)).toBe(true);
    expect(shouldRerender(1, 0.75)).toBe(false);
    expect(shouldRerender(1.5, 0.75)).toBe(true);
  });

  it("only accepts known values", () => {
    expect(parseHints(new URLSearchParams("rs=0.5&fps=60"))).toEqual({ rs: 0.5, fps: 60 });
    expect(parseHints(new URLSearchParams("rs=0.33&fps=1000"))).toEqual({ rs: null, fps: null });
    expect(hintScript({ rs: null, fps: null })).toBe("");
  });

  it("injects first in <head>, or as early as the document allows", () => {
    const s = "<script>x</script>";
    expect(injectIntoHtml('<!doctype html><html lang="en"><head><meta charset="utf-8"><script>app()</script>', s)).toBe(
      '<!doctype html><html lang="en"><head><script>x</script><meta charset="utf-8"><script>app()</script>',
    );
    expect(injectIntoHtml("<!DOCTYPE html><body>hi", s)).toBe("<!DOCTYPE html><script>x</script><body>hi");
    expect(injectIntoHtml("<p>hi", s)).toBe("<script>x</script><p>hi");
  });

  it("the player origin injects them into creatives, and only into HTML", async () => {
    const html = "<!doctype html><html><head><title>ad</title></head></html>";
    const read: ObjectReader = async (key) => {
      const body = key.endsWith(".html") ? html : "binary";
      return { status: 200, body: new Response(body).body, contentLength: body.length, etag: '"e1"' };
    };
    const res = await servePlayerFile(new Request(`https://play.example.com/p/${P}/rev.html?f=9x16&rs=0.5&fps=60`), [P, "rev.html"], read);
    const text = await res.text();
    expect(text).toMatch(/^<!doctype html><html><head><script>.*devicePixelRatio.*return 0\.5.*requestAnimationFrame.*<\/script><title>/);
    expect(res.headers.get("content-length")).toBe(String(new TextEncoder().encode(text).byteLength));
    expect(res.headers.get("etag")).toBe('"e1-h"');
    const plain = await servePlayerFile(new Request(`https://play.example.com/p/${P}/rev.html?f=9x16`), [P, "rev.html"], read);
    expect(await plain.text()).toBe(html);
    const asset = await servePlayerFile(new Request(`https://play.example.com/p/${P}/assets/clip.mp4?rs=0.5`), [P, "assets", "clip.mp4"], read);
    expect(await asset.text()).toBe("binary");
  });
});

import { playerOriginProblem } from "./protocol";

describe("player origin check", () => {
  it("flags the local value shipped to a real site", () => {
    expect(playerOriginProblem("concepts-client.vercel.app", "http://play.localhost:3000")).toMatch(/local address/);
    expect(playerOriginProblem("concepts-client.vercel.app", "")).toMatch(/not set/);
    expect(playerOriginProblem("app.example.com", "https://app.example.com")).toMatch(/separate host/);
  });
  it("accepts a proper split, and localhost while developing", () => {
    expect(playerOriginProblem("concepts-client.vercel.app", "https://concepts-client-play.vercel.app")).toBeNull();
    expect(playerOriginProblem("localhost", "http://play.localhost:3000")).toBeNull();
  });
});
