"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as RDialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { EASE, SPRING, stagger, fadeUp, surface } from "@/lib/motion";
import { formatInfo } from "@/lib/forma-constants";
import { containStyle } from "@/lib/format";
import type { GalleryDirection } from "@/lib/forma-map";
import { CreativeFrame } from "@/components/player/CreativeFrame";
import { usePlayerKeys } from "@/components/player/Transport";
import { Tag } from "@/components/ui/Chip";
import { Kbd } from "@/components/ui/Tooltip";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";

/**
 * Directions, read-only (test-mode gallery, spec §6.1; the full review with
 * comments and decisions is §6.6). Overview: cards side by side, each a live
 * preview in its primary format. Storyboards cycle their scenes on hover.
 * Click opens the focus view: big artboard, scene strip, ←/→ and 1–9.
 */
export function DirectionsGallery({ directions, campaignName }: { directions: GalleryDirection[]; campaignName: string }) {
  const [focus, setFocus] = useState<number | null>(null);

  return (
    <>
      <motion.ul
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        className={cn("grid gap-5", directions.length === 1 ? "max-w-xl" : directions.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}
      >
        {directions.map((d, i) => (
          <motion.li key={d.id} variants={fadeUp}>
            <DirectionCard direction={d} index={i} onOpen={() => setFocus(i)} />
          </motion.li>
        ))}
      </motion.ul>
      <FocusView directions={directions} index={focus} onIndex={setFocus} campaignName={campaignName} />
    </>
  );
}

function DirectionCard({ direction, index, onOpen }: { direction: GalleryDirection; index: number; onOpen: () => void }) {
  const [scene, setScene] = useState(0);
  const timer = useRef<number | null>(null);
  const scenes = direction.scenes;

  function startCycle() {
    if (scenes.length < 2 || timer.current !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = window.setInterval(() => setScene((s) => (s + 1) % scenes.length), 1400);
  }
  function stopCycle() {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setScene(0);
  }
  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={startCycle}
      onPointerLeave={stopCycle}
      onFocus={startCycle}
      onBlur={stopCycle}
      aria-label={`Open direction ${index + 1}: ${direction.title}`}
      className="group flex w-full flex-col gap-4 rounded-card bg-gray p-3 pb-5 text-left transition-[transform,background-color] duration-200 ease-out hover:bg-gray-strong/70 active:scale-[0.99]"
    >
      <div className="grid h-[clamp(300px,50vh,540px)] w-full place-items-center rounded-tile bg-white/70 p-4 [container-type:size]">
        <CreativeFrame
          path={direction.path}
          format={direction.format}
          lang={direction.lang}
          scene={scenes[scene] ?? null}
          poster={direction.keyframeSvg}
          title={`${direction.title}${scenes.length ? `, scene ${scene + 1}` : ""}`}
          className="rounded-tile-sm shadow-pop"
          style={containStyle(direction.format)}
        />
      </div>
      <div className="flex flex-col gap-1.5 px-2">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-navy text-caption font-semibold tabular-nums text-white">{index + 1}</span>
          <h3 className="text-title-sm font-semibold">{direction.title}</h3>
        </div>
        {direction.idea && <p className="text-body text-muted">{direction.idea}</p>}
        {scenes.length > 1 && (
          <div className="mt-1 flex items-center gap-2">
            <span className="flex gap-1" aria-hidden="true">
              {scenes.map((s, i) => (
                <span key={s} className={cn("h-1 rounded-full transition-all duration-300", i === scene ? "w-5 bg-navy" : "w-2 bg-mist")} />
              ))}
            </span>
            <span className="text-caption text-muted">{scenes.length} scenes</span>
          </div>
        )}
      </div>
    </button>
  );
}

function FocusView({
  directions,
  index,
  onIndex,
  campaignName,
}: {
  directions: GalleryDirection[];
  index: number | null;
  onIndex: (i: number | null) => void;
  campaignName: string;
}) {
  const open = index !== null;
  const [dir, setDir] = useState(1);
  const [scene, setScene] = useState(0);
  const d = index !== null ? directions[index] : null;

  function go(next: number) {
    if (index === null) return;
    const n = (next + directions.length) % directions.length;
    setDir(n > index || (index === directions.length - 1 && n === 0) ? 1 : -1);
    setScene(0);
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
    open,
  );

  return (
    <RDialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onIndex(null);
          setScene(0);
        }
      }}
    >
      <AnimatePresence>
        {open && d && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={surface} className="fixed inset-0 z-50 bg-deep/50 backdrop-blur-sm" />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.16 } }}
                transition={SPRING}
                className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-card bg-white shadow-sheet sm:inset-4"
              >
                <header className="flex items-center gap-4 border-b border-line px-4 py-3 sm:px-6">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="kicker truncate">{campaignName}</p>
                    <RDialog.Title className="truncate text-title-sm font-semibold">
                      <span className="tabular-nums text-muted">
                        {index! + 1}/{directions.length}
                      </span>{" "}
                      {d.title}
                    </RDialog.Title>
                  </div>
                  <span className="hidden items-center gap-1 text-caption text-muted md:flex">
                    <Kbd>←</Kbd>
                    <Kbd>→</Kbd> to compare
                  </span>
                  <RDialog.Close aria-label="Close" className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-gray hover:text-navy">
                    <CloseIcon size={18} />
                  </RDialog.Close>
                </header>

                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                  <div className="relative flex min-h-0 flex-1 flex-col bg-gray">
                    <div className="relative min-h-0 flex-1 p-4 sm:p-8">
                      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                        <motion.div
                          key={d.id}
                          custom={dir}
                          initial={{ opacity: 0, x: dir * 40 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: dir * -40 }}
                          transition={{ duration: 0.32, ease: EASE }}
                          className="grid size-full place-items-center [container-type:size]"
                        >
                          <CreativeFrame
                            path={d.path}
                            format={d.format}
                            lang={d.lang}
                            scene={d.scenes[scene] ?? null}
                            poster={d.keyframeSvg}
                            lazy={false}
                            title={d.title}
                            className="rounded-tile shadow-pop"
                            style={containStyle(d.format)}
                          />
                        </motion.div>
                      </AnimatePresence>
                      {directions.length > 1 && (
                        <>
                          <NavButton side="left" onClick={() => go(index! - 1)} />
                          <NavButton side="right" onClick={() => go(index! + 1)} />
                        </>
                      )}
                    </div>
                    {d.scenes.length > 1 && (
                      <div className="flex gap-3 overflow-x-auto border-t border-line bg-white px-4 py-3 sm:px-6" role="radiogroup" aria-label="Scenes">
                        {d.scenes.map((s, i) => (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={i === scene}
                            aria-label={`Scene ${i + 1}`}
                            onClick={() => setScene(i)}
                            className={cn(
                              "flex shrink-0 flex-col items-center gap-1.5 rounded-tile-sm p-1.5 transition-colors",
                              i === scene ? "bg-sky/60" : "hover:bg-gray",
                            )}
                          >
                            <div className="grid h-24 place-items-center [container-type:size]" style={{ width: `${Math.round(96 * Math.min(1.8, formatInfo(d.format).w / formatInfo(d.format).h))}px` }}>
                              <CreativeFrame
                                path={d.path}
                                format={d.format}
                                lang={d.lang}
                                scene={s}
                                poster={d.keyframeSvg}
                                title={`Scene ${i + 1}`}
                                priority={1}
                                className="rounded-[10px]"
                                style={containStyle(d.format)}
                              />
                            </div>
                            <span className={cn("text-caption tabular-nums", i === scene ? "font-semibold text-navy" : "text-muted")}>{i + 1}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <aside className="flex shrink-0 flex-col gap-4 border-t border-line p-5 lg:w-[340px] lg:border-l lg:border-t-0 lg:p-6">
                    <div className="flex flex-col gap-2">
                      <p className="kicker">The idea</p>
                      <p className="text-lead">{d.idea || "No description for this direction."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Tag tone="sky">{formatInfo(d.format).label}</Tag>
                      <Tag>{d.lang.toUpperCase()}</Tag>
                      {d.scenes.length > 1 && <Tag>{d.scenes.length} scenes</Tag>}
                    </div>
                    <p className="mt-auto text-caption text-muted">
                      Previews show the primary format and language. The final comes in every format.
                    </p>
                  </aside>
                </div>
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous direction" : "Next direction"}
      className={cn(
        "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy shadow-pop backdrop-blur transition-[transform,background-color] hover:bg-white active:scale-[0.94]",
        side === "left" ? "left-3 sm:left-5" : "right-3 sm:right-5",
      )}
    >
      {side === "left" ? <ChevronLeftIcon size={20} /> : <ChevronRightIcon size={20} />}
    </button>
  );
}
