"use client";

import { useEffect, useEffectEvent, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import { cn } from "@/lib/cn";
import { formatInfo } from "@/lib/forma-constants";
import { frameUrl, isTimeMessage, type FrameParams, type PlayerCommand, type TimeMessage } from "@/lib/player/protocol";
import { frameQueue } from "@/lib/player/load-queue";
import { DEFAULT_FPS, renderScaleFor, shouldRerender } from "@/lib/player/render-hints";
import { AlertIcon } from "@/components/ui/icons";
import { svgDataUri } from "./svg";

/**
 * One creative, scaled to fit, on the player origin (spec §3.3, §6.7, §7).
 *
 * - The iframe is sandboxed (scripts only) and lives on the separate player origin.
 * - The box reserves the format's aspect ratio: no layout shift.
 * - A poster (the direction's keyframe) shows until the creative has drawn its
 *   first real frame, then the frame fades in: never a white or black flash.
 *   "Real" matters: Forma's runtime answers `hello` before its setup has run (an
 *   empty canvas), so readiness is the runtime's own first draw, not a hello reply;
 *   hello is only a fallback for creatives that stay silent.
 * - Reloads (language, length, scene, render scale) are seamless: the new document
 *   loads behind the one on screen, is seeked to the on-screen time and put in the
 *   same play state, and takes its place only once it shows the same moment. The old
 *   one stays underneath a moment longer, so there is never a gap.
 * - Play/pause are intents: whenever the creative on screen reports a state that
 *   contradicts the last one asked for, the command is sent again.
 * - Off-screen frames pause, and resume when they come back. Lazy by default.
 * - Loads go through one page-wide queue (lib/player/load-queue.ts): at most two
 *   creatives start at once, by priority; the rest show their poster meanwhile.
 * - When the page is hidden (React Activity keeps pages you navigated away from)
 *   or unmounted, the creatives are unloaded, and reload through the queue on return.
 * - Render hints (lib/player/render-hints.ts): the creative renders at the pixel
 *   density it is shown at (or `renderFor`, to be ready for a bigger size), at most
 *   60 fps. Shown bigger, it re-renders sharper (seamlessly, see above); shown much
 *   smaller while playing, it re-renders lighter after a while.
 */

export interface FrameState {
  ready: boolean;
  t: number;
  duration: number;
  playing: boolean;
  /** Posters and preview storyboards: no timeline, no transport. */
  isStatic: boolean;
}

export interface CreativeHandle {
  play(): void;
  pause(): void;
  seek(t: number): void;
  state(): FrameState;
}

export interface CreativeFrameProps extends Omit<FrameParams, "t" | "paused"> {
  ref?: Ref<CreativeHandle>;
  /** Where to start. Changing it reloads the frame. */
  startAt?: number;
  startPaused?: boolean;
  /** Keyframe SVG markup, shown as an image (never inline HTML) until the creative is ready. */
  poster?: string | null;
  title: string;
  className?: string;
  style?: CSSProperties;
  lazy?: boolean;
  pauseOffscreen?: boolean;
  onTime?: (state: FrameState) => void;
  onReady?: (state: FrameState) => void;
  unavailableAfterMs?: number;
  /** Load order: 0 what the user is looking at, 1 warm spares, 2 thumbnails. */
  priority?: number;
  /** Render as if shown at least this big (display scale), so growing to it needs no reload. */
  renderFor?: number;
}

interface Layer {
  key: number;
  url: string;
}

const EMPTY: FrameState = { ready: false, t: 0, duration: 0, playing: false, isStatic: false };
/** A new layer takes over once it shows the same moment, or after this long regardless. */
const SWAP_TIMEOUT_MS = 700;
/** The old layer stays under the new one this long after the swap. */
const KEEP_UNDER_MS = 250;
/** Hello is a fallback: only if a creative has said nothing on its own by then. */
const HELLO_AFTER_MS = 3000;
/** Shown much smaller while playing: re-render lighter after this long (quick back-and-forth costs nothing). */
const LIGHTER_AFTER_MS = 4000;

const parse = (msg: TimeMessage): FrameState => ({
  ready: true,
  t: Number(msg.t) || 0,
  duration: Number(msg.duration) || 0,
  playing: Boolean(msg.playing),
  isStatic: Boolean(msg.static),
});

export function CreativeFrame({
  ref,
  path,
  format,
  lang,
  length,
  scene,
  startAt,
  startPaused,
  poster,
  title,
  className,
  style,
  lazy = true,
  pauseOffscreen = true,
  onTime,
  onReady,
  unavailableAfterMs = 15000,
  priority = 0,
  renderFor,
}: CreativeFrameProps) {
  const info = formatInfo(format);
  /** The URL as the props describe it; render-scale reloads apply to this one only. */
  const base = useMemo(
    () => frameUrl({ path, format, lang, length, scene, t: startAt, paused: startPaused }),
    [path, format, lang, length, scene, startAt, startPaused],
  );
  /** Device pixels per creative pixel; unknown until the box is measured. */
  const [rs, setRs] = useState<number | null>(null);
  /** Where a render-scale reload starts (for the props it was made under). */
  const [resume, setResume] = useState<{ base: string; t: number; paused: boolean } | null>(null);
  const url = useMemo(() => {
    if (rs === null) return null;
    const r = resume && resume.base === base ? resume : null;
    return frameUrl({ path, format, lang, length, scene, t: r ? r.t : startAt, paused: r ? r.paused : startPaused, rs, fps: DEFAULT_FPS });
  }, [base, rs, resume, path, format, lang, length, scene, startAt, startPaused]);

  const boxRef = useRef<HTMLDivElement>(null);
  const frames = useRef(new Map<number, HTMLIFrameElement>());
  /** The state of the creative on screen. */
  const stateRef = useRef<FrameState>(EMPTY);
  /** Last report of every layer, and which layers have drawn for real. */
  const layerState = useRef(new Map<number, FrameState>());
  const started = useRef(new Set<number>());
  /** A new layer catching up with the one on screen. */
  const swap = useRef<{ key: number; deadline: number; timer: number } | null>(null);
  const removal = useRef<number | null>(null);
  const autoPaused = useRef(false);
  /** The last play/pause the parent asked for (null: none yet, the creative decides). */
  const intent = useRef<boolean | null>(null);
  /** Releases the queue slot this frame holds while its newest layer starts. */
  const slot = useRef<(() => void) | null>(null);

  const [near, setNear] = useState(!lazy);
  const [scale, setScale] = useState(0);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [seenUrl, setSeenUrl] = useState<string | null>(null);
  /** The layer on screen. */
  const [shownKey, setShownKey] = useState<number | null>(null);
  /** Fade only the very first appearance (over the poster); swaps are instant. */
  const [fade, setFade] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  /** The URL whose load the queue allowed; a layer is only created for it. */
  const [grantedUrl, setGrantedUrl] = useState<string | null>(null);

  // A new URL adds a layer behind the current one (adjusting state while rendering, not in an effect).
  if (near && url !== null && grantedUrl === url && url !== seenUrl) {
    setSeenUrl(url);
    setUnavailable(false);
    setLayers((prev) => [...prev.filter((l) => l.key === shownKey), { key: (prev.at(-1)?.key ?? 0) + 1, url }]);
  }

  const newestKey = layers.at(-1)?.key ?? null;

  const sendTo = (key: number, msg: PlayerCommand) => frames.current.get(key)?.contentWindow?.postMessage(msg, "*");
  /** Commands reach the creative on screen, and a new one once it has started (never an unstarted one: it would draw an empty frame). */
  const command = (msg: PlayerCommand) => {
    for (const l of layers) if (l.key === shownKey || started.current.has(l.key)) sendTo(l.key, msg);
  };

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        intent.current = true;
        command({ type: "forma:play" });
      },
      pause: () => {
        intent.current = false;
        command({ type: "forma:pause" });
      },
      seek: (t: number) => command({ type: "forma:seek", t }),
      state: () => stateRef.current,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layers, shownKey],
  );

  const reveal = useEffectEvent((key: number, st: FrameState, first: boolean) => {
    if (swap.current) window.clearTimeout(swap.current.timer);
    swap.current = null;
    stateRef.current = st;
    setFade(first);
    setShownKey(key);
    setUnavailable(false);
    if (removal.current !== null) window.clearTimeout(removal.current);
    removal.current = window.setTimeout(() => {
      removal.current = null;
      setLayers((prev) => prev.filter((l) => l.key >= key));
    }, KEEP_UNDER_MS);
    // A reload starts paused: put it in the state the parent last asked for.
    const want = autoPaused.current ? false : intent.current;
    if (want !== null && !st.isStatic && st.playing !== want) sendTo(key, { type: want ? "forma:play" : "forma:pause" });
    onReady?.(st);
    onTime?.(st);
  });

  const trySwap = useEffectEvent((force = false) => {
    const s = swap.current;
    if (!s) return;
    const next = layerState.current.get(s.key);
    const shown = shownKey !== null ? layerState.current.get(shownKey) : undefined;
    if (!next) return;
    if (force || !shown || Math.abs(next.t - shown.t) < 0.1 || performance.now() >= s.deadline) reveal(s.key, next, false);
  });

  const onMessageFrom = useEffectEvent((key: number, msg: TimeMessage) => {
    const st = parse(msg);
    layerState.current.set(key, st);
    const el = frames.current.get(key);
    if (el?.style.visibility) el.style.visibility = "";

    if (key === shownKey) {
      stateRef.current = st;
      // Hold it to the last intent (not while paused for being off-screen; not past the end).
      const want = intent.current;
      if (want !== null && !autoPaused.current && !st.isStatic && st.playing !== want) {
        const atEnd = st.duration > 0 && st.t >= st.duration - 0.05;
        if (!(want && atEnd)) sendTo(key, { type: want ? "forma:play" : "forma:pause" });
      }
      onTime?.(st);
      trySwap();
      return;
    }
    if (key !== newestKey) return; // a layer on its way out

    if (!started.current.has(key)) {
      // Its first real draw.
      started.current.add(key);
      slot.current?.();
      slot.current = null;
      const shown = shownKey !== null ? layerState.current.get(shownKey) : undefined;
      if (!shown || st.isStatic) {
        reveal(key, st, shown === undefined);
        return;
      }
      // Catch up with the frame on screen before taking its place.
      sendTo(key, { type: "forma:seek", t: shown.t });
      const want = autoPaused.current ? false : (intent.current ?? shown.playing);
      sendTo(key, { type: want ? "forma:play" : "forma:pause" });
      swap.current = { key, deadline: performance.now() + SWAP_TIMEOUT_MS, timer: window.setTimeout(() => trySwap(true), SWAP_TIMEOUT_MS) };
      return;
    }
    trySwap();
  });

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!isTimeMessage(e.data)) return;
      for (const [key, el] of frames.current) {
        if (el.contentWindow && el.contentWindow === e.source) {
          onMessageFrom(key, e.data);
          return;
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (swap.current) window.clearTimeout(swap.current.timer);
      if (removal.current !== null) window.clearTimeout(removal.current);
    };
  }, []);

  // Fallback hello for a creative that stays silent; give up calmly after a while.
  const sayHello = useEffectEvent((key: number) => {
    if (!started.current.has(key)) sendTo(key, { type: "forma:hello" });
  });
  useEffect(() => {
    if (newestKey === null || newestKey === shownKey) return;
    let hello: number | null = null;
    const begin = window.setTimeout(() => {
      let tries = 0;
      hello = window.setInterval(() => {
        sayHello(newestKey);
        if (++tries > 20 && hello !== null) window.clearInterval(hello);
      }, 1000);
    }, HELLO_AFTER_MS);
    const giveUp = window.setTimeout(() => setUnavailable(true), unavailableAfterMs);
    return () => {
      window.clearTimeout(begin);
      if (hello !== null) window.clearInterval(hello);
      window.clearTimeout(giveUp);
    };
  }, [newestKey, shownKey, unavailableAfterMs]);

  // Wait for our turn before starting a creative (near the viewport first, see `near`).
  useEffect(() => {
    if (!near || url === null || grantedUrl === url) return;
    let granted = false;
    const release = frameQueue.request(priority, () => {
      granted = true;
      slot.current?.();
      slot.current = release;
      setGrantedUrl(url);
    });
    return () => {
      if (!granted) release();
    };
  }, [near, url, grantedUrl, priority]);
  useEffect(() => () => slot.current?.(), []);

  // Hidden or gone: stop and unload the creatives (a hidden page keeps its DOM, and
  // a creative left running there keeps decoding video and burning the CPU).
  // Shown again: reload them through the queue; the poster covers the wait.
  const restore = useEffectEvent((box: HTMLElement) => {
    for (const el of box.querySelectorAll<HTMLIFrameElement>("iframe[data-unloaded]")) {
      const src = el.dataset.unloaded!;
      const release = frameQueue.request(priority, () => {
        el.addEventListener("load", () => release(), { once: true });
        el.src = src;
        delete el.dataset.unloaded;
      });
    }
  });
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    restore(box);
    return () => {
      for (const el of box.querySelectorAll<HTMLIFrameElement>("iframe")) {
        if (el.dataset.unloaded || !el.src || el.src === "about:blank") continue;
        el.contentWindow?.postMessage({ type: "forma:pause" } satisfies PlayerCommand, "*");
        el.dataset.unloaded = el.src;
        el.style.visibility = "hidden";
        el.src = "about:blank";
      }
    };
  }, []);

  // Render scale follows the on-screen size (or `renderFor`): sharper at once, lighter later (only if it plays).
  const lighter = useRef<number | null>(null);
  const reRender = useEffectEvent((next: number) => {
    const st = stateRef.current;
    if (rs !== null && st.ready) setResume({ base, t: st.t, paused: !st.playing });
    setRs(next);
  });
  const settleLighter = useEffectEvent((next: number) => {
    lighter.current = null;
    if (rs !== null && next < rs && stateRef.current.playing) reRender(next);
  });
  const retarget = useEffectEvent((s: number) => {
    if (lighter.current !== null) window.clearTimeout(lighter.current);
    lighter.current = null;
    if (s <= 0) return;
    const next = renderScaleFor(Math.max(s, renderFor ?? 0), window.devicePixelRatio || 1);
    if (!shouldRerender(rs, next)) return;
    if (rs === null || next > rs) reRender(next);
    else lighter.current = window.setTimeout(() => settleLighter(next), LIGHTER_AFTER_MS);
  });
  const onScale = useEffectEvent((s: number) => {
    setScale(s);
    retarget(s);
  });
  const onRenderFor = useEffectEvent(() => retarget(scale));
  useEffect(() => onRenderFor(), [renderFor]);

  // Scale the native-size artboard to the box.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => onScale(entry.contentRect.width / info.w));
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (lighter.current !== null) window.clearTimeout(lighter.current);
    };
  }, [info.w]);

  // Lazy load near the viewport; pause well off-screen, resume on return.
  const onVisibility = useEffectEvent((visible: boolean) => {
    if (visible) setNear(true);
    if (!pauseOffscreen) return;
    if (!visible && stateRef.current.playing) {
      autoPaused.current = true;
      command({ type: "forma:pause" });
    } else if (visible && autoPaused.current) {
      autoPaused.current = false;
      if (intent.current !== false) command({ type: "forma:play" });
    }
  });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => onVisibility(entry.isIntersecting), { rootMargin: "240px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const posterSrc = svgDataUri(poster);
  const showSkeleton = shownKey === null && !posterSrc && !unavailable;

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={title}
      className={cn("relative isolate overflow-hidden bg-gray", className)}
      style={{ aspectRatio: `${info.w} / ${info.h}`, ...style }}
    >
      {posterSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URI keyframe; rendering SVG as an image keeps it inert
        <img src={posterSrc} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full object-cover" />
      )}
      {showSkeleton && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      {scale > 0 &&
        layers.map((l) => {
          // On screen: the shown layer and, for a moment after a swap, the one it replaced (underneath).
          const visible = shownKey !== null && l.key <= shownKey;
          return (
            <iframe
              key={l.key}
              ref={(el) => {
                if (!el) return;
                frames.current.set(l.key, el);
                return () => {
                  frames.current.delete(l.key);
                  layerState.current.delete(l.key);
                  started.current.delete(l.key);
                };
              }}
              src={l.url}
              title={title}
              sandbox="allow-scripts"
              allow="autoplay"
              referrerPolicy="no-referrer"
              tabIndex={-1}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute left-0 top-0 origin-top-left border-0",
                fade && l.key === shownKey && "transition-opacity duration-300 ease-out",
              )}
              style={{
                width: info.w,
                height: info.h,
                transform: `scale(${scale})`,
                opacity: visible ? 1 : 0,
                colorScheme: "normal",
              }}
            />
          );
        })}
      {unavailable && shownKey === null && (
        <div className="absolute inset-0 grid place-items-center bg-gray/90 p-4 text-center">
          <div className="flex flex-col items-center gap-2 text-muted">
            <AlertIcon size={20} />
            <p className="text-small font-medium text-navy">This preview is unavailable</p>
            <p className="text-caption">We&apos;ve been told. Try again in a moment.</p>
          </div>
        </div>
      )}
    </div>
  );
}
