"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/cn";
import { formatTimecode, FRAME_STEP } from "@/lib/player/protocol";
import { PauseIcon, PlayIcon } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Play/pause, scrubber and timecode (spec §6.7). The scrubber is a native range
 * input, so keyboard and screen readers work; dragging pauses and resumes.
 */
export function Transport({
  t,
  duration,
  playing,
  onPlay,
  onPause,
  onSeek,
  disabled,
  tone = "light",
  className,
}: {
  t: number;
  duration: number;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
  disabled?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const resumeAfterScrub = useRef(false);
  const pct = duration > 0 ? Math.min(100, (t / duration) * 100) : 0;
  const dark = tone === "dark";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Tooltip content={playing ? "Pause" : "Play"} shortcut="Space">
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          disabled={disabled}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-150 active:scale-[0.94] disabled:opacity-40",
            dark ? "bg-white text-navy hover:bg-ice" : "bg-navy text-white hover:bg-hover",
          )}
        >
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} className="translate-x-px" />}
        </button>
      </Tooltip>
      <input
        type="range"
        className="scrub flex-1"
        aria-label="Playback position"
        aria-valuetext={`${formatTimecode(t)} of ${formatTimecode(duration)}`}
        min={0}
        max={duration || 0}
        step={FRAME_STEP}
        value={Math.min(t, duration || 0)}
        disabled={disabled || !duration}
        style={
          {
            "--p": `${pct}%`,
            ...(dark ? { "--scrub-fill": "#fff", "--scrub-track": "rgb(255 255 255 / 0.25)", "--scrub-thumb": "#fff", "--scrub-ring": "var(--color-deep)" } : {}),
          } as React.CSSProperties
        }
        onPointerDown={() => {
          resumeAfterScrub.current = playing;
          if (playing) onPause();
        }}
        onPointerUp={() => {
          if (resumeAfterScrub.current) onPlay();
          resumeAfterScrub.current = false;
        }}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <span className={cn("shrink-0 text-small tabular-nums", dark ? "text-white/80" : "text-muted")}>
        <span className={dark ? "text-white" : "text-navy"}>{formatTimecode(t)}</span> / {formatTimecode(duration)}
      </span>
    </div>
  );
}

export interface PlayerKeyHandlers {
  toggle: () => void;
  seekBy: (delta: number) => void;
  seekTo?: (t: number) => void;
  fullscreen?: () => void;
  next?: () => void;
  prev?: () => void;
  jump?: (index: number) => void;
}

/**
 * True when a dialog other than the one holding `scope` is open on top: shortcuts of
 * the page (or of a dialog underneath) must not act behind it.
 */
export function blockedByDialog(scope: HTMLElement | null): boolean {
  const open = document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
  const top = open[open.length - 1];
  return Boolean(top && !(scope && top.contains(scope)));
}

/**
 * Viewer shortcuts: Space/K play-pause · ←/→ one frame (Shift: 1 s) · J/L ∓1 s ·
 * Home start · F fullscreen · 1–9 jump.
 * - Letters match the physical key (`e.code`), so they work on any keyboard layout
 *   (a Russian layout types "л" on K).
 * - Ignored while typing, and while another dialog is open on top of `scope`.
 * - Space is left to the button or link it would press; arrows to sliders, radios
 *   and tabs that own them (a plain button has no use for arrows, so they work there).
 */
export interface KeyInput {
  code: string;
  key: string;
  shiftKey: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
}

export interface KeyContext {
  /** Focus is in a text field. */
  typing: boolean;
  /** Focus is on a button or link (Space presses it). */
  pressable: boolean;
  /** Focus is on a control that uses arrows itself (slider, radio, tab, menu item, option). */
  ownsArrows: boolean;
  has: { next: boolean; prev: boolean; seekTo: boolean; fullscreen: boolean; jump: boolean };
}

export type PlayerKeyAction =
  | { type: "toggle" }
  | { type: "seekBy"; delta: number }
  | { type: "seekTo"; t: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "fullscreen" }
  | { type: "jump"; index: number };

/** Pure: which viewer action a key press means here (null: none, let it through). */
export function playerKeyAction(e: KeyInput, ctx: KeyContext): { action: PlayerKeyAction; preventDefault: boolean } | null {
  if (e.metaKey || e.ctrlKey || e.altKey || ctx.typing) return null;
  const code = e.code;
  if ((code === "Space" && !ctx.pressable) || code === "KeyK") return { action: { type: "toggle" }, preventDefault: true };
  if ((code === "ArrowLeft" || code === "ArrowRight") && !ctx.ownsArrows) {
    const dir = code === "ArrowRight" ? 1 : -1;
    if (ctx.has.next && ctx.has.prev && !e.shiftKey && !ctx.has.seekTo) return { action: { type: dir > 0 ? "next" : "prev" }, preventDefault: true };
    return { action: { type: "seekBy", delta: dir * (e.shiftKey ? 1 : FRAME_STEP) }, preventDefault: true };
  }
  if (code === "KeyJ") return { action: { type: "seekBy", delta: -1 }, preventDefault: false };
  if (code === "KeyL") return { action: { type: "seekBy", delta: 1 }, preventDefault: false };
  if (code === "Home" && ctx.has.seekTo && !ctx.ownsArrows) return { action: { type: "seekTo", t: 0 }, preventDefault: true };
  if (code === "KeyF" && ctx.has.fullscreen && !e.repeat) return { action: { type: "fullscreen" }, preventDefault: true };
  const digit = /^Digit([1-9])$/.exec(code)?.[1] ?? (/^[1-9]$/.test(e.key) ? e.key : null);
  if (digit && ctx.has.jump) return { action: { type: "jump", index: Number(digit) - 1 }, preventDefault: false };
  return null;
}

export function usePlayerKeys(handlers: PlayerKeyHandlers, enabled = true, scope?: RefObject<HTMLElement | null>) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (blockedByDialog(scope?.current ?? null)) return;
      const h = ref.current;
      const r = playerKeyAction(e, {
        typing: Boolean(target?.closest("input:not([type=range]), textarea, select, [contenteditable=true]")),
        pressable: Boolean(target?.closest("button, a, [role=button]")),
        ownsArrows: Boolean(target?.closest("input[type=range], [role=slider], [role=tab], [role=radio], [role=menuitem], [role=option]")),
        has: { next: Boolean(h.next), prev: Boolean(h.prev), seekTo: Boolean(h.seekTo), fullscreen: Boolean(h.fullscreen), jump: Boolean(h.jump) },
      });
      if (!r) return;
      if (r.preventDefault) e.preventDefault();
      const a = r.action;
      if (a.type === "toggle") h.toggle();
      else if (a.type === "seekBy") h.seekBy(a.delta);
      else if (a.type === "seekTo") h.seekTo?.(a.t);
      else if (a.type === "next") h.next?.();
      else if (a.type === "prev") h.prev?.();
      else if (a.type === "fullscreen") h.fullscreen?.();
      else h.jump?.(a.index);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, scope]);
}
