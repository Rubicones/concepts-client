"use client";

import { useSyncExternalStore } from "react";
import { timeAgo } from "@/lib/format";

const subscribe = (onChange: () => void) => {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
};

/**
 * "2 hours ago", computed in the browser. The server can't know "now" without
 * making the page dynamic (and a cached page would show a stale "now"), so it
 * renders the plain date and the browser replaces it after hydration.
 */
export function RelativeTime({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => timeAgo(iso, Math.floor(Date.now() / 60_000) * 60_000),
    () => absolute(iso),
  );
  return (
    <time dateTime={iso} title={absolute(iso)} suppressHydrationWarning>
      {prefix}
      {label}
    </time>
  );
}

function absolute(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `on ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : "";
}
