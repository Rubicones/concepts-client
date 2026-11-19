"use client";

import { useEffect } from "react";
import "./globals.css";

/** Last resort when the root layout itself fails: plain, on-brand, with a retry. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[root]", error);
  }, [error]);
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-white p-6 font-sans text-navy">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-title font-semibold">Something went wrong</h1>
          <p className="text-body text-muted">The dashboard couldn&apos;t start. Try again in a moment; if it keeps happening, write to us.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="h-11 rounded-full bg-navy px-6 text-small font-bold uppercase tracking-[0.04em] text-white transition-colors hover:bg-hover"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
