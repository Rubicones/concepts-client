import type { NextRequest } from "next/server";
import { getObject } from "@/lib/r2";
import { servePlayerFile, type ObjectReader } from "@/lib/player/serve";

/** /p/<project>/<file> on the player host only (proxy.ts refuses it elsewhere). Streams from R2 with Range support. */

const readFromR2: ObjectReader = async (key, range) => {
  try {
    const obj = await getObject(key, range);
    if (!obj) return null;
    return {
      status: obj.$metadata.httpStatusCode === 206 ? 206 : 200,
      body: obj.Body ? (obj.Body.transformToWebStream() as ReadableStream<Uint8Array>) : null,
      contentLength: obj.ContentLength,
      contentRange: obj.ContentRange,
      etag: obj.ETag,
    };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "InvalidRange" || e.$metadata?.httpStatusCode === 416) return { status: 416 };
    throw err;
  }
};

async function handle(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return servePlayerFile(request, path, readFromR2);
}

export const GET = handle;
export const HEAD = handle;
