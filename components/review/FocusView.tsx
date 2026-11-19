"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as RDialog } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion, type PanInfo, type Variants } from "motion/react";
import { cn } from "@/lib/cn";
import { EASE, surface } from "@/lib/motion";
import { formatInfo } from "@/lib/forma-constants";
import { containStyle } from "@/lib/format";
import { commentsFor, countLabel, type CommentView } from "@/campaign/review";
import type { DirectionSnapshot } from "@/campaign/types";
import { CreativeFrame } from "@/components/player/CreativeFrame";
import { blockedByDialog, usePlayerKeys } from "@/components/player/Transport";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Dialog";
import { Kbd, Tooltip } from "@/components/ui/Tooltip";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PinIcon } from "@/components/ui/icons";
import { CommentPanel } from "./CommentPanel";
import { PinLayer } from "./PinLayer";
import { useMediaQuery, type NewComment } from "./useComments";

export const FULL_CLIP = "inset(0px 0px 0px 0px round 32px)";

/** The clip that makes the full-screen panel look like the card it opens from. */
export function clipFor(rect: DOMRect | null | undefined): string {
  if (!rect) return FULL_CLIP;
  const inset = window.innerWidth >= 640 ? 16 : 8;
  const w = window.innerWidth - inset * 2;
  const h = window.innerHeight - inset * 2;
  const top = Math.max(0, rect.top - inset);
  const left = Math.max(0, rect.left - inset);
  const right = Math.max(0, w - (rect.left - inset + rect.width));
  const bottom = Math.max(0, h - (rect.top - inset + rect.height));
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 24px)`;
}

export interface FocusActions {
  add: (c: NewComment) => Promise<boolean>;
  edit: (id: string, patch: { body?: string; x?: number; y?: number }) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

/**
 * One direction, big (spec §6.6). Artboard centred on a soft stage, scene strip
 * below, comments on the right (a bottom sheet on phones), the decision in a
 * footer. ←/→ or a swipe compares, 1–3 jumps, C toggles comment mode.
 */
export function FocusView({
  directions,
  index,
  onIndex,
  onClose,
  enterClip,
  exitClip,
  title,
  comments,
  editable,
  actions,
  hovered,
  onHover,
  onChoose,
  rebuild,
}: {
  directions: DirectionSnapshot[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  enterClip: string;
  exitClip: string;
  title: string;
  comments: CommentView[];
  editable: boolean;
  actions?: FocusActions;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onChoose?: (d: DirectionSnapshot) => void;
  /** The rebuild button, rendered by the parent so the overview and the focus share one. */
  rebuild?: React.ReactNode;
}) {
  const open = index !== null;
  const d = index !== null ? directions[index] : null;
  const reduce = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)");
  const coarse = useMediaQuery("(pointer: coarse)");

  const [dir, setDir] = useState(1);
  const [scene, setScene] = useState(0);
  const [commentMode, setCommentMode] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  function go(next: number) {
    if (index === null) return;
    const n = (next + directions.length) % directions.length;
    if (n === index) return;
    setDir(n > index || (index === directions.length - 1 && n === 0) ? 1 : -1);
    setScene(0);
    setDraft(null);
    setSelected(null);
    onIndex(n);
  }

  usePlayerKeys(
    {
      toggle: () => {},
      seekBy: () => {},
      next: () => index !== null && go(index + 1),
      prev: () => index !== null && go(index - 1),
      jump: (i) => i < directions.length && go(i),
    },
    open && !draft,
    contentRef,
  );

  // C: comment mode (the physical key, any layout). Ignored while typing or under another dialog.
  useEffect(() => {
    if (!open || !editable) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || e.repeat) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (blockedByDialog(contentRef.current)) return;
      if (e.code === "KeyC") {
        e.preventDefault();
        setCommentMode((m) => !m);
        setDraft(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editable]);

  const mine = d ? commentsFor(comments, d.id) : { pins: [], general: [] };
  const sceneId = d?.scenes[scene] ?? null;
  const visiblePins = mine.pins.filter((p) => p.scene === sceneId || (p.scene === null && scene === 0) || (d?.scenes.length ?? 0) === 0);
  const ownCount = mine.pins.length + mine.general.length;
  const totalCount = comments.length;

  function select(id: string) {
    const c = comments.find((x) => x.id === id);
    if (!c || !d) return;
    if (c.scene && d.scenes.includes(c.scene)) setScene(d.scenes.indexOf(c.scene));
    setSelected(id);
    if (!wide && c.x === null) setSheet(true);
  }

  const sceneLabel = (s: string | null) => {
    if (!d || d.scenes.length < 2) return null;
    const i = s ? d.scenes.indexOf(s) : 0;
    return `Scene ${Math.max(0, i) + 1}`;
  };

  const panelVariants: Variants = reduce
    ? { from: { opacity: 0 }, shown: { opacity: 1, transition: surface }, to: { opacity: 0, transition: { duration: 0.16 } } }
    : {
        from: (clip: string) => ({ clipPath: clip, opacity: 0.5 }),
        shown: { clipPath: FULL_CLIP, opacity: 1, transition: { duration: 0.42, ease: EASE } },
        to: (clip: string) => ({ clipPath: clip, opacity: clip === FULL_CLIP ? 0 : 0.6, transition: { duration: 0.32, ease: EASE } }),
      };

  const panel = d && (
    <CommentPanel
      pins={mine.pins}
      general={mine.general}
      editable={editable}
      hovered={hovered}
      onHover={onHover}
      selected={selected}
      onSelect={select}
      onEdit={(id, body) => actions?.edit(id, { body }) ?? Promise.resolve(false)}
      onDelete={(id) => void actions?.remove(id)}
      onAddGeneral={(body) => actions?.add({ itemId: d.id, scene: null, format: d.format, lang: d.lang, x: null, y: null, body }) ?? Promise.resolve(false)}
      sceneLabel={sceneLabel}
      otherCount={totalCount - ownCount}
      commentMode={commentMode}
    />
  );

  return (
    <RDialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setScene(0);
          setDraft(null);
          setCommentMode(false);
          setSelected(null);
          onClose();
        }
      }}
    >
      <AnimatePresence custom={exitClip}>
        {open && d && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={surface} className="fixed inset-0 z-50 bg-deep/50 backdrop-blur-sm" />
            </RDialog.Overlay>
            <RDialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onEscapeKeyDown={(e) => {
                // Esc steps back one layer at a time: the comment box, comment mode, then the view.
                const active = document.activeElement as HTMLElement | null;
                if (draft) {
                  e.preventDefault();
                  setDraft(null);
                } else if (active?.closest("textarea, input")) {
                  e.preventDefault();
                  active.blur();
                } else if (commentMode) {
                  e.preventDefault();
                  setCommentMode(false);
                }
              }}
            >
              <motion.div
                ref={contentRef}
                custom={enterClip}
                variants={panelVariants}
                initial="from"
                animate="shown"
                exit="to"
                className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-card bg-white shadow-sheet sm:inset-4"
              >
                <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:gap-4 sm:px-6">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="kicker truncate">{title}</p>
                    <RDialog.Title className="truncate text-title-sm font-semibold">
                      <span className="tabular-nums text-muted">
                        {index! + 1}/{directions.length}
                      </span>{" "}
                      {d.title}
                    </RDialog.Title>
                  </div>
                  <span className="hidden items-center gap-1 text-caption text-muted xl:flex">
                    <Kbd>←</Kbd>
                    <Kbd>→</Kbd> to compare
                  </span>
                  {editable && (
                    <Tooltip content={commentMode ? "Click the picture to place a pin" : "Point at a detail"} shortcut="C">
                      <Button
                        size="sm"
                        variant={commentMode ? "primary" : "secondary"}
                        aria-pressed={commentMode}
                        leading={<PinIcon size={15} />}
                        onClick={() => {
                          setCommentMode((m) => !m);
                          setDraft(null);
                        }}
                      >
                        {commentMode ? "Commenting" : "Comment"}
                      </Button>
                    </Tooltip>
                  )}
                  {!wide && (
                    <Button size="sm" variant="ghost" onClick={() => setSheet(true)} aria-label={`Comments on this direction: ${ownCount}`}>
                      <span className="tabular-nums">{ownCount}</span>
                      <span className="hidden sm:inline">{ownCount === 1 ? "comment" : "comments"}</span>
                    </Button>
                  )}
                  <RDialog.Close aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-gray hover:text-navy">
                    <CloseIcon size={18} />
                  </RDialog.Close>
                </header>

                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                  <div className="relative flex min-h-0 flex-1 flex-col bg-gray">
                    {commentMode && (
                      <p className="pointer-events-none absolute inset-x-0 top-3 z-20 mx-auto w-fit rounded-full bg-navy px-3 py-1.5 text-caption font-medium text-white shadow-pop" role="status">
                        {coarse ? "Tap" : "Click"} the picture where you mean
                      </p>
                    )}
                    <div className="relative min-h-0 flex-1 p-4 sm:p-8">
                      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                        <motion.div
                          key={d.id}
                          custom={dir}
                          initial={{ opacity: 0, x: reduce ? 0 : dir * 40 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: reduce ? 0 : dir * -40 }}
                          transition={{ duration: 0.32, ease: EASE }}
                          drag={coarse && !commentMode && !draft && directions.length > 1 ? "x" : false}
                          dragSnapToOrigin
                          dragElastic={0.25}
                          onDragEnd={(_: unknown, info: PanInfo) => {
                            if (info.offset.x < -70 || info.velocity.x < -500) go(index! + 1);
                            else if (info.offset.x > 70 || info.velocity.x > 500) go(index! - 1);
                          }}
                          className="grid size-full place-items-center [container-type:size]"
                        >
                          <div className="relative" style={{ ...containStyle(d.format), aspectRatio: `${formatInfo(d.format).w} / ${formatInfo(d.format).h}` }}>
                            <CreativeFrame
                              path={d.path}
                              format={d.format}
                              lang={d.lang}
                              scene={sceneId}
                              poster={d.keyframeSvg}
                              lazy={false}
                              title={d.title}
                              className="rounded-tile shadow-pop"
                              style={{ width: "100%" }}
                            />
                            <PinLayer
                              pins={visiblePins}
                              commentMode={commentMode}
                              draft={draft}
                              onDraft={setDraft}
                              onCreate={(x, y, body) => {
                                setDraft(null);
                                void actions?.add({ itemId: d.id, scene: sceneId, format: d.format, lang: d.lang, x, y, body });
                              }}
                              onMove={(id, x, y) => void actions?.edit(id, { x, y })}
                              onSelect={select}
                              hovered={hovered ?? selected}
                              onHover={onHover}
                              nextNumber={mine.pins.length + 1}
                              editable={editable}
                            />
                          </div>
                        </motion.div>
                      </AnimatePresence>
                      {directions.length > 1 && !coarse && (
                        <>
                          <NavButton side="left" onClick={() => go(index! - 1)} />
                          <NavButton side="right" onClick={() => go(index! + 1)} />
                        </>
                      )}
                    </div>
                    {d.scenes.length > 1 && <SceneStrip d={d} scene={scene} onScene={(i) => (setScene(i), setDraft(null))} />}
                    {coarse && directions.length > 1 && (
                      <div className="flex justify-center gap-1.5 bg-white pb-2 pt-1" aria-hidden="true">
                        {directions.map((x, i) => (
                          <span key={x.id} className={cn("h-1.5 rounded-full transition-all duration-300", i === index ? "w-5 bg-navy" : "w-1.5 bg-mist")} />
                        ))}
                      </div>
                    )}
                  </div>

                  {wide && (
                    <aside className="flex min-h-0 w-[360px] shrink-0 flex-col border-l border-line">
                      <About d={d} />
                      {panel}
                    </aside>
                  )}
                </div>

                {editable && onChoose && (
                  <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
                    <p className="mr-auto hidden text-small text-muted sm:block">
                      {totalCount ? `${countLabel(totalCount)} will be sent with your decision.` : "Comments are optional. They go with your decision."}
                    </p>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      {rebuild}
                      <Button className="flex-1 sm:flex-none" onClick={() => onChoose(d)}>
                        Choose this direction
                      </Button>
                    </div>
                  </footer>
                )}
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
      {!wide && d && (
        <Sheet open={open && sheet} onOpenChange={setSheet} side="bottom" title={`Comments · ${d.title}`} className="!gap-3 !px-0">
          <div className="-mx-1 flex max-h-[62dvh] flex-col">
            <div className="px-5">
              <About d={d} compact />
            </div>
            {panel}
          </div>
        </Sheet>
      )}
    </RDialog.Root>
  );
}

function About({ d, compact }: { d: DirectionSnapshot; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-line", compact ? "pb-4" : "p-5 lg:p-6")}>
      <p className="text-lead">{d.idea || "No description for this direction."}</p>
      {d.studioNote && (
        <p className="rounded-tile-sm bg-ice p-3 text-small">
          <span className="font-semibold">From us · </span>
          {d.studioNote}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Tag tone="sky">{formatInfo(d.format).label}</Tag>
        <Tag>{d.lang.toUpperCase()}</Tag>
        {d.scenes.length > 1 && <Tag>{d.scenes.length} scenes</Tag>}
      </div>
      {!compact && <p className="text-caption text-muted">The preview shows the main format and language. The final comes in every format.</p>}
    </div>
  );
}

function SceneStrip({ d, scene, onScene }: { d: DirectionSnapshot; scene: number; onScene: (i: number) => void }) {
  const info = formatInfo(d.format);
  return (
    <div className="flex gap-3 overflow-x-auto border-t border-line bg-white px-4 py-3 sm:px-6" role="radiogroup" aria-label="Scenes">
      {d.scenes.map((s, i) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={i === scene}
          aria-label={`Scene ${i + 1}`}
          onClick={() => onScene(i)}
          className={cn("flex shrink-0 flex-col items-center gap-1.5 rounded-tile-sm p-1.5 transition-colors", i === scene ? "bg-sky/60" : "hover:bg-gray")}
        >
          <div className="grid h-20 place-items-center [container-type:size] sm:h-24" style={{ width: `${Math.round(96 * Math.min(1.8, info.w / info.h))}px` }}>
            <CreativeFrame path={d.path} format={d.format} lang={d.lang} scene={s} poster={d.keyframeSvg} title={`Scene ${i + 1}`} priority={1} className="rounded-[10px]" style={containStyle(d.format)} />
          </div>
          <span className={cn("text-caption tabular-nums", i === scene ? "font-semibold text-navy" : "text-muted")}>{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous direction" : "Next direction"}
      className={cn(
        "absolute top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy shadow-pop backdrop-blur transition-[transform,background-color] hover:bg-white active:scale-[0.94]",
        side === "left" ? "left-3 sm:left-5" : "right-3 sm:right-5",
      )}
    >
      {side === "left" ? <ChevronLeftIcon size={20} /> : <ChevronRightIcon size={20} />}
    </button>
  );
}
