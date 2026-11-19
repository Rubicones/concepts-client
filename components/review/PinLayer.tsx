"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { clamp01, type CommentView } from "@/campaign/review";
import { Button } from "@/components/ui/Button";
import { isTemp } from "./useComments";

export type NumberedPin = CommentView & { n: number };

/** A pin-shaped cursor (tip at the bottom-left, like the pins themselves). */
const PIN_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M3 25V12A9 9 0 1 1 12 21H3z" fill="#0c2b3f" stroke="#fff" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
)}") 3 25, crosshair`;

/**
 * Pins over the scaled artboard (spec §6.6). The layer sits exactly over the
 * creative, so (x, y) are 0–1 of the artboard and pins stay put on resize.
 * In comment mode the layer catches clicks (the sandboxed iframe can't report
 * them) and opens a small composer at the spot.
 */
export function PinLayer({
  pins,
  commentMode,
  draft,
  onDraft,
  onCreate,
  onMove,
  onSelect,
  hovered,
  onHover,
  nextNumber,
  editable,
}: {
  pins: NumberedPin[];
  commentMode: boolean;
  draft: { x: number; y: number } | null;
  onDraft: (p: { x: number; y: number } | null) => void;
  onCreate: (x: number, y: number, body: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  hovered: string | null;
  onHover: (id: string | null) => void;
  nextNumber: number;
  editable: boolean;
}) {
  const layerRef = useRef<HTMLDivElement>(null);

  function pointFrom(e: { clientX: number; clientY: number }) {
    const r = layerRef.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  }

  return (
    <div ref={layerRef} className="absolute inset-0 z-10">
      {commentMode && editable && (
        <button
          type="button"
          aria-label="Place a comment on the picture"
          className="absolute inset-0 rounded-[inherit] outline-offset-4"
          style={{ cursor: PIN_CURSOR }}
          onClick={(e) => {
            // Keyboard activation (no pointer position) drops the pin in the middle.
            onDraft(e.detail === 0 ? { x: 0.5, y: 0.5 } : pointFrom(e));
          }}
        />
      )}
      <AnimatePresence>
        {pins.map((p) => (
          <Pin
            key={p.id}
            pin={p}
            layer={layerRef}
            draggable={editable && p.state === "draft" && !isTemp(p.id)}
            hovered={hovered === p.id}
            onHover={onHover}
            onMove={onMove}
            onSelect={onSelect}
          />
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {draft && (
          <Composer key={`${draft.x}:${draft.y}`} at={draft} number={nextNumber} onCancel={() => onDraft(null)} onSave={(body) => onCreate(draft.x, draft.y, body)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PinShape({ n, active, ghost }: { n: number; active?: boolean; ghost?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-full rounded-bl-[4px] text-caption font-semibold tabular-nums text-white shadow-pin transition-[background-color,transform] duration-150",
        ghost ? "bg-hover" : active ? "scale-110 bg-hover" : "bg-navy",
      )}
    >
      {n}
    </span>
  );
}

function Pin({
  pin,
  layer,
  draggable,
  hovered,
  onHover,
  onMove,
  onSelect,
}: {
  pin: NumberedPin;
  layer: React.RefObject<HTMLDivElement | null>;
  draggable: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
}) {
  // While dragging or nudging, the pin follows locally; the server hears once it settles.
  const [local, setLocal] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  // When the saved position changes (server answer, or a rollback), it wins over the local one.
  const saved = `${pin.x},${pin.y}`;
  const [seenSaved, setSeenSaved] = useState(saved);
  if (saved !== seenSaved) {
    setSeenSaved(saved);
    setLocal(null);
  }
  const commit = useRef<number | null>(null);
  useEffect(() => () => {
    if (commit.current !== null) window.clearTimeout(commit.current);
  }, []);

  const x = local?.x ?? pin.x ?? 0;
  const y = local?.y ?? pin.y ?? 0;

  function toPoint(e: PointerEvent) {
    const r = layer.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (!draggable || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, moved: false };
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
    d.moved = true;
    setLocal(toPoint(e));
  }
  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      justDragged.current = true;
      const p = toPoint(e);
      setLocal(p);
      onMove(pin.id, p.x, p.y);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!draggable) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = { x: clamp01(x + delta[0]), y: clamp01(y + delta[1]) };
    setLocal(next);
    if (commit.current !== null) window.clearTimeout(commit.current);
    commit.current = window.setTimeout(() => onMove(pin.id, next.x, next.y), 500);
  }

  return (
    <motion.button
      type="button"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0, transition: { duration: 0.14 } }}
      transition={SPRING}
      aria-label={`Comment ${pin.n}: ${pin.body}${draggable ? ". Arrow keys move it." : ""}`}
      className={cn("absolute z-10 origin-bottom-left touch-none select-none rounded-full rounded-bl-[4px] after:absolute after:-inset-2.5 after:rounded-full", draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, translateY: "-100%" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setLocal(null);
      }}
      onClick={() => {
        // A drag ends with a click event too; only a real click selects.
        if (justDragged.current) {
          justDragged.current = false;
          return;
        }
        onSelect(pin.id);
      }}
      onKeyDown={onKeyDown}
      onPointerEnter={() => onHover(pin.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(pin.id)}
      onBlur={() => onHover(null)}
    >
      <PinShape n={pin.n} active={hovered} />
    </motion.button>
  );
}

function Composer({ at, number, onCancel, onSave }: { at: { x: number; y: number }; number: number; onCancel: () => void; onSave: (body: string) => void }) {
  const [body, setBody] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  // Open towards the free side so the box never covers the spot or leaves the stage.
  const right = at.x > 0.55;
  const up = at.y > 0.62;

  function save() {
    const text = body.trim();
    if (text) onSave(text);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0, transition: { duration: 0.12 } }}
        transition={SPRING}
        className="absolute origin-bottom-left"
        style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%`, translateY: "-100%" }}
        aria-hidden="true"
      >
        <PinShape n={number} ghost />
      </motion.span>
      <motion.div
        role="dialog"
        aria-label={`Comment ${number}`}
        initial={{ opacity: 0, y: up ? 6 : -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
        transition={SPRING}
        className="pointer-events-auto absolute flex w-[min(280px,80vw)] flex-col gap-2 rounded-tile-sm bg-white p-3 shadow-sheet"
        style={{
          left: `${at.x * 100}%`,
          top: `${at.y * 100}%`,
          translateX: right ? "calc(-100% - 8px)" : "36px",
          translateY: up ? "calc(-100% - 36px)" : "-14px",
        }}
      >
        <textarea
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              save();
            }
          }}
          rows={3}
          maxLength={4000}
          placeholder="What should change here?"
          aria-label="Your comment"
          className="w-full resize-none rounded-input bg-gray px-3 py-2.5 text-body leading-[22px] outline-none placeholder:text-muted focus-visible:shadow-ring [field-sizing:content] max-h-40 min-h-[70px]"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption text-muted">Enter to save · Esc to cancel</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" disabled={!body.trim()} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
