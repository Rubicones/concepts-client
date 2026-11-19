import { formatInfo, language } from "./forma-constants";

/** "2 hours ago", "yesterday", "3 Nov". Plain and short. `now` is explicit: render it in the browser (RelativeTime). */
export function timeAgo(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.round((now - then) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (s < 45) return "just now";
  if (s < 60 * 45) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 60 * 60 * 20) return rtf.format(-Math.round(s / 3600), "hour");
  if (s < 60 * 60 * 24 * 6) return rtf.format(-Math.round(s / 86400), "day");
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: s > 60 * 60 * 24 * 300 ? "numeric" : undefined });
}

export const formatLabels = (ids: string[]) => ids.map((id) => formatInfo(id).label).join(" · ");
export const languageCodes = (codes: string[]) => codes.map((c) => c.toUpperCase()).join(" · ");
export const languageNames = (codes: string[]) => codes.map((c) => language(c).name).join(", ");
export const lengthLabels = (lengths: number[]) => lengths.map((l) => `${l} s`).join(" · ");

/**
 * Inline style that fits a format inside a box with `container-type: size`
 * (contain, never crop): width = min(box width, box height × ratio).
 */
export function containStyle(format: string): { width: string } {
  const f = formatInfo(format);
  return { width: `min(100cqw, calc(100cqh * ${(f.w / f.h).toFixed(5)}))` };
}
