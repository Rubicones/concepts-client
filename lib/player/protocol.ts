/**
 * Forma's player protocol (forma/motion.mjs controllers, forma/public/player.js).
 * Do not change it: the same creatives play in Forma and here.
 *
 *  load   ${PLAYER_ORIGIN}${path}?f=<format>&l=<lang>&d=<length>[&scene=<id>][&t=<s>][&paused]
 *  post   {type:'forma:hello'|'forma:play'|'forma:pause'|'forma:seek', t}
 *  hear   {type:'forma:time', t, duration, playing, static?, timeline?}
 *
 * `rs` and `fps` are read by our player origin only (render hints, lib/player/render-hints.ts);
 * creatives and Forma never see them.
 */

export const PLAYER_ORIGIN = (process.env.NEXT_PUBLIC_PLAYER_ORIGIN ?? "").replace(/\/+$/, "");

export interface FrameParams {
  path: string;
  format: string;
  lang?: string | null;
  /** Final videos only: which length to play. */
  length?: number | null;
  /** Storyboard previews: which scene to show. */
  scene?: string | null;
  /** Start here (keeps the time when switching format or language). */
  t?: number | null;
  paused?: boolean;
}

export interface RenderHints {
  rs?: number | null;
  fps?: number | null;
}

export function frameUrl({ path, format, lang, length, scene, t, paused, rs, fps }: FrameParams & RenderHints, origin = PLAYER_ORIGIN): string {
  const q = new URLSearchParams({ f: format });
  if (lang) q.set("l", lang);
  if (length) q.set("d", String(length));
  if (scene) q.set("scene", scene);
  if (t && t > 0) q.set("t", t.toFixed(3));
  if (rs) q.set("rs", String(rs));
  if (fps) q.set("fps", String(fps));
  let url = `${origin}${path}?${q.toString()}`;
  if (paused) url += "&paused";
  return url;
}

export type PlayerCommand =
  | { type: "forma:hello" }
  | { type: "forma:play" }
  | { type: "forma:pause" }
  | { type: "forma:seek"; t: number };

export interface TimeMessage {
  type: "forma:time";
  t: number;
  duration: number;
  playing: boolean;
  static?: boolean;
  timeline?: boolean;
}

export function isTimeMessage(data: unknown): data is TimeMessage {
  return Boolean(data && typeof data === "object" && (data as { type?: unknown }).type === "forma:time");
}

/** m:ss.cc, tabular. */
export function formatTimecode(t: number): string {
  const safe = Math.max(0, Number.isFinite(t) ? t : 0);
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

/** One frame at 30 fps: the step for ←/→. */
export const FRAME_STEP = 1 / 30;
