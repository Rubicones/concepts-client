import { projectObjectKey } from "../r2-keys";
import { hintScript, injectIntoHtml, parseHints } from "./render-hints";

/**
 * The creative player origin (spec §3.3). Creatives are HTML written by a model:
 * untrusted. They are served only from the player host, sandboxed by CSP, with
 * the exact headers of Forma's preview origin (forma/store/supabase.mjs
 * PREVIEW_SECURITY_HEADERS). Kept free of Next and AWS imports so it is unit-tested
 * with a fake object store.
 */

export const PLAYER_SECURITY_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src blob:; base-uri 'none'; form-action 'none'",
};

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  avif: "image/avif", ico: "image/x-icon", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", wav: "audio/wav", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf",
  pdf: "application/pdf", txt: "text/plain; charset=utf-8", md: "text/markdown; charset=utf-8",
};

export function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

/** HTML gets a short cache (revisions can be re-rendered); everything else is content-addressed or uuid-named. */
export function cacheControlFor(path: string): string {
  return /\.html?$/i.test(path) ? "public, max-age=60, stale-while-revalidate=300" : "public, max-age=31536000, immutable";
}

export type ObjectResult =
  | { status: 200 | 206; body: ReadableStream<Uint8Array> | null; contentLength?: number; contentRange?: string; etag?: string }
  | { status: 416; size?: number };

/** Reads `key` (optionally a byte range). Returns null when the object does not exist. */
export type ObjectReader = (key: string, range?: string) => Promise<ObjectResult | null>;

/** Only single, well-formed byte ranges reach storage; anything else is ignored (full body), as browsers expect. */
export function cleanRange(header: string | null): string | undefined {
  if (!header) return undefined;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return undefined;
  return `bytes=${m[1]}-${m[2]}`;
}

function plain(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { ...PLAYER_SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * GET/HEAD /p/<project>/<...rel> → projects/<project>/<...rel>.
 * Like Forma: a miss outside assets/ retries assets/<rest> (models sometimes drop the folder).
 */
export async function servePlayerFile(request: Request, segments: string[], read: ObjectReader): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return plain(405, "Method not allowed");
  const [project, ...rel] = segments;
  if (!project || project === "history") return plain(404, "Not found");

  const key = projectObjectKey(project, rel);
  if (!key) return plain(404, "Not found");
  const fallback = rel.length && rel[0] !== "assets" ? projectObjectKey(project, ["assets", ...rel]) : null;
  const range = cleanRange(request.headers.get("range"));

  let found: ObjectResult | null = null;
  let servedKey = key;
  try {
    found = await read(key, range);
    if (!found && fallback) {
      servedKey = fallback;
      found = await read(fallback, range);
    }
  } catch (err) {
    console.error("[player] storage error for", key, err);
    return plain(502, "Could not load the file from storage.");
  }
  if (!found) {
    // A missing creative is a broken delivery: worth a line in the server log.
    if (/\.html?$/i.test(key)) console.warn("[player] missing creative", key);
    return plain(404, "Not found");
  }

  if (found.status === 416) {
    return new Response(null, {
      status: 416,
      headers: { ...PLAYER_SECURITY_HEADERS, ...(found.size !== undefined ? { "Content-Range": `bytes */${found.size}` } : {}) },
    });
  }

  const headers: Record<string, string> = {
    ...PLAYER_SECURITY_HEADERS,
    "Content-Type": contentTypeFor(servedKey),
    "Cache-Control": cacheControlFor(servedKey),
    "Accept-Ranges": "bytes",
  };
  if (found.contentLength !== undefined) headers["Content-Length"] = String(found.contentLength);
  if (found.status === 206 && found.contentRange) headers["Content-Range"] = found.contentRange;
  if (found.etag) headers.ETag = found.etag;

  if (request.method === "HEAD") {
    await found.body?.cancel().catch(() => {});
    return new Response(null, { status: found.status, headers });
  }

  // Render hints (lib/player/render-hints.ts): only for whole HTML documents.
  const script = found.status === 200 && /\.html?$/i.test(servedKey) ? hintScript(parseHints(new URL(request.url).searchParams)) : "";
  if (script && found.body) {
    const html = injectIntoHtml(await new Response(found.body).text(), script);
    const bytes = new TextEncoder().encode(html);
    headers["Content-Length"] = String(bytes.byteLength);
    if (headers.ETag) headers.ETag = headers.ETag.replace(/"$/, '-h"');
    return new Response(bytes, { status: 200, headers });
  }
  return new Response(found.body, { status: found.status, headers });
}
