"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { LayoutGroup, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { LAYOUT } from "@/lib/motion";
import { formatInfo, language } from "@/lib/forma-constants";
import type { GalleryFinal } from "@/lib/forma-map";
import { containStyle } from "@/lib/format";
import { CreativeFrame, type CreativeHandle, type FrameState } from "./CreativeFrame";
import { Transport, usePlayerKeys } from "./Transport";
import { ChoicePill, ChoiceRow, FormatChip } from "./FormatChip";
import { SegmentedControl } from "@/components/ui/Segmented";
import { Tooltip } from "@/components/ui/Tooltip";
import { ExpandIcon, GridIcon } from "@/components/ui/icons";
import { useMediaQuery } from "@/components/review/useComments";

/**
 * The final, in every format (spec §6.7).
 *
 * Wall: every format side by side, playing in sync under one transport; language
 * and length apply to all. Sync = the same forma:seek/forma:play to every frame,
 * with drift corrected from their forma:time replies against the first format.
 *
 * Focus: one format large with format/language/length switchers, frame-accurate
 * scrubbing, fullscreen; the other formats wait as thumbnails, paused.
 *
 * Languages are pre-rendered: every format has one frame per language, loaded
 * (through the page-wide queue, after the visible ones) and kept paused at the
 * current time, hidden (`visibility: hidden`, so the browser stops painting them).
 * Switching language swaps visible frames instantly — no reload. Length changes
 * the timeline, so it reloads at the current time.
 *
 * Each frame renders at the density it is shown at (render hints in CreativeFrame).
 * In focus every format is pre-rendered at the size it would have if focused, so
 * switching format is a seek + play of a frame that is already there. Hovering a
 * tile (or "One format") warms that format up the same way before the click; and
 * any reload swaps in only once it shows the same moment, so nothing ever flashes.
 *
 * The frames keep their place in the tree in every mode, so nothing reloads when
 * moving between wall and focus (an iframe that moves in the DOM reloads).
 */

const DRIFT = 0.12;
/** Check drift at most every 0.6 s of playback (measured on the clock itself, not the wall). */
const CORRECT_EVERY = 0.6;
/**
 * At most this many frames at once (visible + warm spares). Browsers keep ~16 WebGL
 * contexts per page; past that they drop the oldest. Beyond the budget, spare
 * languages are kept only for the format in focus.
 */
const FRAME_BUDGET = 12;
/** Phones and tablets: less memory, fewer contexts. */
const FRAME_BUDGET_COMPACT = 6;
const noSubscribe = () => () => {};

const keyOf = (format: string, lang: string) => `${format}|${lang}`;

export function FinalViewer({ final, actions }: { final: GalleryFinal; /** Right side of the controls row (the Download button). */ actions?: ReactNode }) {
  const formats = final.formats.length ? final.formats : ["1x1"];
  const langs = final.langs.length ? final.langs : ["en"];
  const isPoster = final.kind === "poster";

  const [mode, setMode] = useState<"wall" | "focus">("wall");
  const [focusFormat, setFocusFormat] = useState(formats[0]);
  const [lang, setLang] = useState(langs[0]);
  const [length, setLength] = useState<number | null>(final.lengths[0] ?? null);
  /** Where frames start when they (re)load: changes only with the length. */
  const [startAt, setStartAt] = useState(0);
  /** Other languages load once the first visible frame is ready. */
  const [warm, setWarm] = useState(false);
  const [clock, setClock] = useState<{ t: number; duration: number; playing: boolean }>({ t: 0, duration: length ?? 0, playing: false });

  const handles = useRef(new Map<string, CreativeHandle>());
  /** What the viewer should be doing; frames load paused and follow it once ready. */
  const wantPlay = useRef(!isPoster);
  const pending = useRef<FrameState | null>(null);
  const raf = useRef<number | null>(null);
  const lastCorrection = useRef(-1);
  /** The viewer's current time (the master's last report, or the last seek). Survives master changes. */
  const lastT = useRef(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** The focus box: the stage's inner width × the focused height (min(66vh, 760px)). */
  const [focusBox, setFocusBox] = useState<{ w: number; h: number } | null>(null);
  /** A format the pointer rests on: pre-render it for focus before the click. */
  const [warmFormat, setWarmFormat] = useState<string | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const allKeys = formats.flatMap((f) => langs.map((l) => keyOf(f, l))).join(",");
  // Stable ref callbacks per frame (inline ones would detach and re-attach every render).
  const frameRefs = useMemo(
    () =>
      Object.fromEntries(
        allKeys.split(",").map((k) => [
          k,
          (h: CreativeHandle | null) => {
            if (h) handles.current.set(k, h);
            else handles.current.delete(k);
          },
        ]),
      ) as Record<string, (h: CreativeHandle | null) => void>,
    [allKeys],
  );

  /** Frames that have shown a real frame at least once (so they can take over instantly). */
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  /** The language on screen while the chosen one is still loading (where it wasn't pre-rendered). */
  const [leaving, setLeaving] = useState<string | null>(null);
  const shownLang = (f: string) => (leaving === null || ready.has(keyOf(f, lang)) ? lang : leaving);
  const visibleFormats = mode === "wall" ? formats : [focusFormat];
  const master = keyOf(visibleFormats[0], shownLang(visibleFormats[0]));
  const activeKeys = visibleFormats.map((f) => keyOf(f, shownLang(f)));
  const visibleSig = activeKeys.join(",");
  const active = () => activeKeys.map((k) => handles.current.get(k)).filter((h): h is CreativeHandle => Boolean(h));

  function onTime(key: string, s: FrameState) {
    if (key !== master) return;
    lastT.current = s.t;
    pending.current = s;
    if (raf.current === null) {
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        const p = pending.current;
        if (p) setClock({ t: p.t, duration: p.duration, playing: p.playing });
      });
    }
    if (mode !== "wall" || !s.playing) return;
    if (Math.abs(s.t - lastCorrection.current) < CORRECT_EVERY) return;
    lastCorrection.current = s.t;
    for (const k of activeKeys) {
      if (k === key) continue;
      const h = handles.current.get(k);
      const o = h?.state();
      if (!h || !o?.ready || o.isStatic) continue;
      if (Math.abs(o.t - s.t) > DRIFT) h.seek(s.t);
      if (!o.playing) h.play();
    }
  }

  function onReady(key: string, s: FrameState) {
    const h = handles.current.get(key);
    if (!h) return;
    if (!ready.has(key)) setReady((prev) => new Set(prev).add(key));
    const [f, l] = key.split("|");
    // The chosen language is ready everywhere it shows: stop showing the old one.
    if (leaving !== null && l === lang && visibleFormats.every((vf) => vf === f || ready.has(keyOf(vf, lang)))) setLeaving(null);
    if (key === master) {
      setWarm(true);
      if (!wantPlay.current || s.isStatic) return;
      for (const other of active()) {
        if (other !== h && other.state().ready) other.seek(s.t);
        other.play();
      }
      return;
    }
    h.seek(lastT.current);
    // Visible, or about to be (the chosen language replacing the old one): run in step.
    const runs = activeKeys.includes(key) || (l === lang && visibleFormats.includes(f));
    if (runs && wantPlay.current) h.play();
    else h.pause();
  }

  // Mode, format or language changed: the visible frames pick up at the viewer's time and keep
  // playing if it was playing (the new master included); the rest wait, paused.
  useEffect(() => {
    const t = lastT.current;
    const visible = new Set(visibleSig.split(","));
    for (const [k, h] of handles.current) {
      if (!visible.has(k)) {
        h.pause();
        continue;
      }
      h.seek(t);
      if (wantPlay.current) h.play();
      else h.pause();
    }
  }, [visibleSig]);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setFocusBox({ w, h: Math.min(window.innerHeight * 0.66, 760) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** The display scale a format would have in focus. */
  const focusScale = (f: string) => {
    if (!focusBox) return undefined;
    const info = formatInfo(f);
    return Math.min(focusBox.w / info.w, focusBox.h / info.h);
  };
  const warmSoon = (f: string | null) => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = f === null ? null : window.setTimeout(() => setWarmFormat(f), 250);
    if (f === null) setWarmFormat(null);
  };

  const play = () => {
    wantPlay.current = true;
    const atEnd = clock.duration > 0 && clock.t >= clock.duration - 0.02;
    if (atEnd) lastT.current = 0;
    for (const h of active()) {
      if (atEnd) h.seek(0);
      h.play();
    }
    setClock((c) => ({ ...c, playing: true, t: atEnd ? 0 : c.t }));
  };
  const pause = () => {
    wantPlay.current = false;
    for (const h of active()) h.pause();
    setClock((c) => ({ ...c, playing: false }));
  };
  const seek = (t: number) => {
    const clamped = Math.max(0, Math.min(clock.duration || t, t));
    lastT.current = clamped;
    // Warm spares move too, so a language switch lands on the same frame.
    for (const h of handles.current.values()) h.seek(clamped);
    setClock((c) => ({ ...c, t: clamped }));
  };

  /**
   * Instant where the language is pre-rendered (it is parked at this time). Where it
   * isn't (phones, big deliveries), the current language stays on screen, playing,
   * until the new one shows the same moment — never a poster or a pause.
   */
  function switchLang(l: string) {
    if (l === lang) return;
    const t = lastT.current;
    for (const f of visibleFormats) {
      const h = handles.current.get(keyOf(f, l));
      if (!h) continue;
      h.seek(t);
      if (wantPlay.current) h.play();
      else h.pause();
    }
    const allReady = visibleFormats.every((f) => ready.has(keyOf(f, l)));
    setLeaving(allReady ? null : lang);
    setWarm(true);
    setLang(l);
  }

  /** A new length is a new timeline: every frame reloads at the current time. */
  function switchLength(n: number) {
    if (n === length) return;
    setStartAt(lastT.current);
    setLength(n);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen?.();
  }

  // iPhone Safari can't put a page element fullscreen: no button, no F there.
  const canFullscreen = useSyncExternalStore(noSubscribe, () => Boolean(document.fullscreenEnabled), () => false);

  usePlayerKeys(
    {
      toggle: () => (isPoster ? undefined : clock.playing ? pause() : play()),
      seekBy: (delta) => !isPoster && seek(clock.t + delta),
      seekTo: (t) => !isPoster && seek(t),
      fullscreen: mode === "focus" && canFullscreen ? toggleFullscreen : undefined,
    },
    true,
    shellRef,
  );

  const focused = formatInfo(focusFormat);
  const compact = useMediaQuery("(max-width: 639px), (pointer: coarse)");
  const sparesEverywhere = formats.length * langs.length <= (compact ? FRAME_BUDGET_COMPACT : FRAME_BUDGET);

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-5">
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {actions && <div className="order-last ml-auto flex items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{actions}</div>}
          <span onPointerEnter={() => mode === "wall" && warmSoon(focusFormat)} onPointerLeave={() => warmSoon(null)}>
          <SegmentedControl
            label="View"
            value={mode}
            onChange={setMode}
            options={[
              { value: "wall", label: <span className="inline-flex items-center gap-1.5"><GridIcon size={14} />All formats</span> },
              { value: "focus", label: <span className="inline-flex items-center gap-1.5"><ExpandIcon size={14} />One format</span> },
            ]}
          />
          </span>
          {langs.length > 1 && (
            <ChoiceRow label="Language">
              {langs.map((l) => (
                <ChoicePill key={l} selected={l === lang} onSelect={() => switchLang(l)} title={language(l).name}>
                  {l.toUpperCase()}
                </ChoicePill>
              ))}
            </ChoiceRow>
          )}
          {!isPoster && final.lengths.length > 1 && (
            <ChoiceRow label="Length">
              {final.lengths.map((n) => (
                <ChoicePill key={n} selected={n === length} onSelect={() => switchLength(n)}>
                  {n} s
                </ChoicePill>
              ))}
            </ChoiceRow>
          )}
        </div>

        {mode === "focus" && formats.length > 1 && (
          <ChoiceRow label="Format">
            {formats.map((f) => (
              <FormatChip key={f} format={f} size="sm" selected={f === focusFormat} onSelect={() => setFocusFormat(f)} />
            ))}
          </ChoiceRow>
        )}

        {/* Fullscreen takes the stage and the transport together, so the controls stay. */}
        <div ref={shellRef} className="flex flex-col gap-5 [&:fullscreen]:gap-3 [&:fullscreen]:bg-deep [&:fullscreen]:p-4">
          <div
            ref={stageRef}
            className={cn(
              "flex flex-wrap justify-center rounded-card bg-gray p-4 sm:p-6 [:fullscreen>&]:min-h-0 [:fullscreen>&]:flex-1 [:fullscreen>&]:items-center [:fullscreen>&]:bg-transparent",
              mode === "wall" ? "items-end gap-5" : "items-start gap-3",
            )}
            style={{ "--wall-h": "clamp(220px, 42vh, 460px)" } as CSSProperties}
          >
            {/* Frames: one list for both modes, so switching animates instead of reloading. */}
            {formats.map((f) => {
              const info = formatInfo(f);
              const isFocus = mode === "focus" && f === focusFormat;
              const isThumb = mode === "focus" && f !== focusFormat;
              return (
                <motion.div
                  key={f}
                  layout
                  transition={LAYOUT}
                  className={cn(
                    "group relative flex flex-col items-center gap-2",
                    isFocus && "order-first h-[min(66vh,760px)] w-full basis-full [container-type:size] [:fullscreen_&]:h-[calc(100vh-180px)]",
                    isThumb && "order-1",
                    mode === "wall" && "max-sm:w-full",
                  )}
                >
                  {/* The box keeps its place in the tree in every mode; the languages stack inside it. */}
                  <div
                    className={cn(
                      "relative overflow-hidden transition-[opacity,box-shadow] duration-200",
                      isFocus && "mx-auto rounded-tile-sm shadow-pop",
                      isThumb && "h-16 rounded-[10px] opacity-75 group-hover:opacity-100",
                      mode === "wall" && "h-[var(--wall-h)] rounded-tile-sm shadow-pop group-hover:shadow-sheet max-sm:h-auto max-sm:w-full",
                    )}
                    style={{ aspectRatio: `${info.w} / ${info.h}`, ...(isFocus ? containStyle(f) : {}) }}
                  >
                    {langs.map((l) => {
                      const k = keyOf(f, l);
                      const shown = l === shownLang(f);
                      const target = l === lang;
                      if (!shown && !target && !(warm && (sparesEverywhere || isFocus))) return null;
                      return (
                        <CreativeFrame
                          key={k}
                          ref={frameRefs[k]}
                          path={final.path}
                          format={f}
                          lang={l}
                          length={isPoster ? null : length}
                          startAt={startAt}
                          startPaused
                          poster={final.keyframeSvg}
                          priority={shown || target ? (isThumb ? 1 : 0) : 2}
                          renderFor={mode === "focus" || warmFormat === f ? focusScale(f) : undefined}
                          title={`${final.title}, ${info.label} ${info.name}, ${language(l).name}`}
                          onTime={(s) => onTime(k, s)}
                          onReady={(s) => onReady(k, s)}
                          className={cn("!absolute inset-0 !bg-transparent", !shown && "invisible")}
                          style={{ width: "100%", height: "100%" }}
                        />
                      );
                    })}
                  </div>
                  {!isFocus && (
                    <button
                      type="button"
                      onPointerEnter={() => mode === "wall" && warmSoon(f)}
                      onPointerLeave={() => warmSoon(null)}
                      onClick={() => {
                        setFocusFormat(f);
                        setMode("focus");
                      }}
                      aria-label={`Show ${info.label} ${info.name} large`}
                      className="absolute inset-0 rounded-tile-sm"
                    />
                  )}
                  {mode === "wall" && (
                    <p className="text-small text-muted">
                      <span className="font-medium text-navy">{info.label}</span> {info.name}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Transport + focused format details */}
          <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-tile bg-white/95 p-3 shadow-pop backdrop-blur sm:flex-row sm:items-center sm:gap-5 sm:p-4 [:fullscreen>&]:static">
            {isPoster ? (
              <p className="flex-1 text-small text-muted">Static poster: one frame per format and language.</p>
            ) : (
              <Transport className="flex-1" t={clock.t} duration={clock.duration} playing={clock.playing} onPlay={play} onPause={pause} onSeek={seek} />
            )}
            {mode === "focus" && (
              <div className="flex items-center gap-3">
                <span className="text-small text-muted tabular-nums">
                  <span className="font-medium text-navy">{focused.name}</span> · {focused.w}×{focused.h}
                </span>
                {canFullscreen && (
                <Tooltip content="Fullscreen" shortcut="F">
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label="Fullscreen (F)"
                    className="grid size-10 place-items-center rounded-full bg-gray transition-[transform,background-color] hover:bg-gray-strong active:scale-[0.94]"
                  >
                    <ExpandIcon size={16} />
                  </button>
                </Tooltip>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </LayoutGroup>
  );
}
