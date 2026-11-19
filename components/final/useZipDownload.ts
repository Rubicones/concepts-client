"use client";

import { useEffect, useRef, useState } from "react";
import { makeZip } from "client-zip";
import { signDownloads } from "@/app/actions/final";

export interface ZipProgress {
  /** 0–1 by bytes when sizes are known, else by files. */
  value: number;
  file: string;
  index: number;
  count: number;
}

type SavePicker = (opts: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{
  createWritable(): Promise<WritableStream<Uint8Array>>;
}>;

const isAbort = (e: unknown) => (e as { name?: string })?.name === "AbortError";

/**
 * Downloads the chosen exports (spec §6.8). One file: a direct link with its proper
 * name. Several: a ZIP streamed in the browser (client-zip) from presigned GETs,
 * straight to disk where the browser allows it (File System Access), else to a
 * Blob. Progress by bytes; Cancel aborts every request and the file.
 */
export function useZipDownload(campaignId: string) {
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const abort = useRef<AbortController | null>(null);
  const raf = useRef<number | null>(null);
  useEffect(
    () => () => {
      abort.current?.abort();
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  async function start(
    keys: string[],
    zipName: string,
  ): Promise<{ ok: true; failed: string[] } | { ok: false; error: string; cancelled?: boolean }> {
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ value: 0, file: "", index: 0, count: keys.length });

    const signed = await signDownloads(campaignId, keys);
    if (!signed.ok) {
      setProgress(null);
      return { ok: false, error: signed.error };
    }
    const files = signed.data;

    if (files.length === 1) {
      // Content-Disposition (set when signing) names the file; the link never navigates away.
      const a = document.createElement("a");
      a.href = files[0].url;
      a.rel = "noopener";
      document.body.append(a);
      a.click();
      a.remove();
      setProgress(null);
      return { ok: true, failed: [] };
    }

    const total = files.reduce((s, f) => s + (f.size ?? 0), 0);
    const bySize = files.every((f) => f.size);
    let loaded = 0;
    const failed: string[] = [];
    const report = (index: number, file: string) => {
      if (raf.current !== null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        setProgress({ value: bySize && total ? loaded / total : index / files.length, file, index, count: files.length });
      });
    };

    async function* entries() {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const name = f.path.slice(f.path.lastIndexOf("/") + 1);
        report(i, name);
        let res: Response;
        try {
          res = await fetch(f.url, { signal: controller.signal });
        } catch (e) {
          if (isAbort(e)) throw e;
          failed.push(name);
          continue;
        }
        if (!res.ok || !res.body) {
          failed.push(name);
          continue;
        }
        const counted = res.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, ctl) {
              loaded += chunk.byteLength;
              report(i, name);
              ctl.enqueue(chunk);
            },
          }),
        );
        yield { name: f.path, input: counted, lastModified: new Date() };
      }
    }

    try {
      const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
      if (picker) {
        let writable: WritableStream<Uint8Array>;
        try {
          const handle = await picker({ suggestedName: zipName, types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }] });
          writable = await handle.createWritable();
        } catch (e) {
          setProgress(null);
          // Closing the save dialog is a choice, not an error.
          return isAbort(e) ? { ok: false, error: "", cancelled: true } : { ok: false, error: "We couldn't open the file to save to." };
        }
        await makeZip(entries()).pipeTo(writable, { signal: controller.signal });
      } else {
        const blob = await new Response(makeZip(entries())).blob();
        if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipName;
        document.body.append(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      if (failed.length === files.length) return { ok: false, error: "None of the files could be downloaded. Try again in a moment." };
      return { ok: true, failed };
    } catch (e) {
      if (isAbort(e) || controller.signal.aborted) return { ok: false, error: "", cancelled: true };
      console.error("[download]", e);
      return { ok: false, error: "The download stopped. Check your connection and try again." };
    } finally {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
      abort.current = null;
      setProgress(null);
    }
  }

  return { progress, start, cancel: () => abort.current?.abort() };
}
