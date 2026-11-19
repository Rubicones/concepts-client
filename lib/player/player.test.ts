import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { cleanRange, PLAYER_SECURITY_HEADERS, servePlayerFile, type ObjectReader } from "./serve";
import { decideHost } from "./hosts";

const P = "6f1a3c6e-8a0b-4a49-9b8e-6f6c9b6f6a01";
const FORMA_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src blob:; base-uri 'none'; form-action 'none'";

function stream(text: string) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text));
      c.close();
    },
  });
}

/** A fake R2: a map of keys to contents, honouring single byte ranges like R2 does. */
function fakeR2(objects: Record<string, string>) {
  const calls: { key: string; range?: string }[] = [];
  const read: ObjectReader = async (key, range) => {
    calls.push({ key, range });
    const body = objects[key];
    if (body === undefined) return null;
    if (!range) return { status: 200, body: stream(body), contentLength: body.length, etag: '"e1"' };
    const [, a, b] = /bytes=(\d*)-(\d*)/.exec(range)!;
    let start = a === "" ? body.length - Number(b) : Number(a);
    let end = a === "" || b === "" ? body.length - 1 : Math.min(Number(b), body.length - 1);
    if (start >= body.length) return { status: 416, size: body.length };
    start = Math.max(0, start);
    end = Math.max(start, end);
    const part = body.slice(start, end + 1);
    return { status: 206, body: stream(part), contentLength: part.length, contentRange: `bytes ${start}-${end}/${body.length}` };
  };
  return { read, calls };
}

const req = (url: string, init?: RequestInit) => new Request(`https://play.example.com${url}`, init);

describe("player file route", () => {
  const { read, calls } = fakeR2({
    [`projects/${P}/rev.html`]: "<!doctype html><title>ad</title>",
    [`projects/${P}/assets/clip.mp4`]: "0123456789abcdefghij",
    [`projects/${P}/assets/Pack/logo.svg`]: "<svg/>",
  });

  it("serves HTML with Forma's exact CSP and a short cache", async () => {
    const res = await servePlayerFile(req(`/p/${P}/rev.html`), [P, "rev.html"], read);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe(FORMA_CSP);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toMatch(/max-age=60/);
    expect(await res.text()).toContain("<title>ad</title>");
  });

  it("answers Range with 206 and Content-Range for video seeking", async () => {
    const res = await servePlayerFile(req(`/p/${P}/assets/clip.mp4`, { headers: { range: "bytes=2-5" } }), [P, "assets", "clip.mp4"], read);
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 2-5/20");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(await res.text()).toBe("2345");
  });

  it("answers an unsatisfiable range with 416", async () => {
    const res = await servePlayerFile(req(`/p/${P}/assets/clip.mp4`, { headers: { range: "bytes=99-" } }), [P, "assets", "clip.mp4"], read);
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */20");
  });

  it("retries assets/<rest> like Forma when the model dropped the folder", async () => {
    calls.length = 0;
    const res = await servePlayerFile(req(`/p/${P}/Pack/logo.svg`), [P, "Pack", "logo.svg"], read);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(calls.map((c) => c.key)).toEqual([`projects/${P}/Pack/logo.svg`, `projects/${P}/assets/Pack/logo.svg`]);
  });

  it("refuses traversal, dot-files, history and non-uuid projects", async () => {
    for (const segs of [[P, "..", "x"], [P, ".env"], ["history", "x.json"], ["not-a-uuid", "a.html"], [P]]) {
      const res = await servePlayerFile(req("/p/x"), segs, read);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-security-policy")).toBe(FORMA_CSP);
    }
  });

  it("serves HEAD without a body and refuses other methods", async () => {
    const head = await servePlayerFile(req(`/p/${P}/rev.html`, { method: "HEAD" }), [P, "rev.html"], read);
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
    const post = await servePlayerFile(req(`/p/${P}/rev.html`, { method: "POST" }), [P, "rev.html"], read);
    expect(post.status).toBe(405);
  });

  it("says so calmly when storage fails", async () => {
    const res = await servePlayerFile(req(`/p/${P}/rev.html`), [P, "rev.html"], async () => {
      throw new Error("boom");
    });
    expect(res.status).toBe(502);
  });

  it("only passes well-formed single ranges to storage", () => {
    expect(cleanRange("bytes=0-")).toBe("bytes=0-");
    expect(cleanRange("bytes=-500")).toBe("bytes=-500");
    expect(cleanRange("bytes=0-1,4-5")).toBeUndefined();
    expect(cleanRange("items=0-1")).toBeUndefined();
    expect(cleanRange(null)).toBeUndefined();
  });

  it("keeps the CORS header creatives need from their opaque sandbox origin", () => {
    expect(PLAYER_SECURITY_HEADERS["Access-Control-Allow-Origin"]).toBe("*");
  });
});

describe("host split", () => {
  const playerHost = "play.example.com";
  it("the app host refuses /p/* and /lib/*", () => {
    expect(decideHost({ host: "app.example.com", pathname: `/p/${P}/rev.html`, playerHost })).toBe("deny");
    expect(decideHost({ host: "app.example.com", pathname: "/lib/gsap.js", playerHost })).toBe("deny");
    expect(decideHost({ host: "app.example.com", pathname: "/styleguide", playerHost })).toBe("allow");
    expect(decideHost({ host: "app.example.com", pathname: "/players", playerHost })).toBe("allow");
  });
  it("the player host refuses app routes", () => {
    expect(decideHost({ host: "play.example.com", pathname: "/", playerHost })).toBe("deny");
    expect(decideHost({ host: "play.example.com", pathname: "/styleguide", playerHost })).toBe("deny");
    expect(decideHost({ host: "PLAY.example.com", pathname: "/api/anything", playerHost })).toBe("deny");
    expect(decideHost({ host: "play.example.com", pathname: `/p/${P}/rev.html`, playerHost })).toBe("allow");
    expect(decideHost({ host: "play.example.com", pathname: "/lib/three/build/three.module.js", playerHost })).toBe("allow");
  });
  it("with no player origin configured, creatives are served nowhere", () => {
    expect(decideHost({ host: "localhost:3000", pathname: `/p/${P}/rev.html`, playerHost: null })).toBe("deny");
  });

  it("proxy() applies the decision to real requests", async () => {
    process.env.NEXT_PUBLIC_PLAYER_ORIGIN = "https://play.example.com";
    const { proxy } = await import("../../proxy");
    const on = (host: string, pathname: string) =>
      proxy(new NextRequest(`https://${host}${pathname}`, { headers: { host } }));
    expect(on("app.example.com", `/p/${P}/a.html`).status).toBe(404);
    expect(on("play.example.com", "/").status).toBe(404);
    expect(on("play.example.com", `/p/${P}/a.html`).headers.get("x-middleware-next")).toBe("1");
    expect(on("app.example.com", "/").headers.get("x-middleware-next")).toBe("1");
  });
});

describe("player libraries", () => {
  const forma = path.join(process.env.FORMA_DIR ?? path.resolve(import.meta.dirname, "../../../../forma"), "package.json");
  it.skipIf(!existsSync(forma))("pin the same versions as Forma", () => {
    const ours = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../package.json"), "utf8"));
    const theirs = JSON.parse(readFileSync(forma, "utf8"));
    for (const lib of ["three", "gsap", "lottie-web"]) {
      expect(ours.devDependencies[lib], lib).toBe(theirs.dependencies[lib]);
    }
  });
});
