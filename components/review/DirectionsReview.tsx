"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { fadeUp, stagger } from "@/lib/motion";
import { formatInfo } from "@/lib/forma-constants";
import { containStyle } from "@/lib/format";
import { MAX_REBUILDS } from "@/lib/limits";
import { countLabel, type CommentView } from "@/campaign/review";
import type { DeliveryView, DirectionSnapshot } from "@/campaign/types";
import { CreativeFrame } from "@/components/player/CreativeFrame";
import { svgDataUri } from "@/components/player/svg";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Feedback";
import { Kbd, Tooltip } from "@/components/ui/Tooltip";
import { ApproveDialog, RebuildSheet } from "./DecisionSheets";
import { clipFor, FocusView, FULL_CLIP } from "./FocusView";
import { useComments } from "./useComments";

/**
 * The directions review (spec §6.6): three directions side by side, a focus view
 * to compare and comment, and the decision. Comments are drafts until the
 * client approves one direction or asks for new ones.
 */
export function DirectionsReview({
  campaignId,
  campaignName,
  version,
  delivery,
  comments: initial,
  rebuildsUsed,
}: {
  campaignId: string;
  campaignName: string;
  version: number;
  delivery: DeliveryView;
  comments: CommentView[];
  rebuildsUsed: number;
}) {
  const { items, add, edit, remove } = useComments(initial, delivery.id);
  const directions = delivery.directions;
  const cards = useRef<(HTMLElement | null)[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const [clips, setClips] = useState({ enter: FULL_CLIP, exit: FULL_CLIP });
  const [hovered, setHovered] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<DirectionSnapshot | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const left = Math.max(0, MAX_REBUILDS - rebuildsUsed);
  const decision = { campaignId, version, deliveryId: delivery.id };
  const roundTitle = `${campaignName}${delivery.round > 1 ? ` · Round ${delivery.round}` : ""}`;

  function openAt(i: number) {
    setClips((c) => ({ ...c, enter: clipFor(cards.current[i]?.getBoundingClientRect()) }));
    setFocus(i);
  }
  function close() {
    setClips((c) => ({ ...c, exit: focus === null ? FULL_CLIP : clipFor(cards.current[focus]?.getBoundingClientRect()) }));
    setFocus(null);
  }
  function choose(d: DirectionSnapshot) {
    setChoosing(d);
    setApproveOpen(true);
  }

  const rebuildButton = (
    <RebuildButton left={left} onClick={() => setRebuildOpen(true)} className="flex-1 sm:flex-none" />
  );

  return (
    <div className="flex flex-col gap-6">
      {left === 0 && (
        <Banner tone="attention" title="This is the last round">
          You&apos;ve used both rebuilds, so one of these three becomes your final. Your comments shape it.
        </Banner>
      )}

      <motion.ul variants={stagger(0.06)} initial="hidden" animate="show" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {directions.map((d, i) => (
          <motion.li key={d.id} variants={fadeUp} className="flex">
            <DirectionCard
              direction={d}
              index={i}
              count={items.filter((c) => c.itemId === d.id).length}
              artRef={(el) => {
                cards.current[i] = el;
              }}
              onOpen={() => openAt(i)}
              onChoose={() => choose(d)}
            />
          </motion.li>
        ))}
      </motion.ul>

      <div className="flex flex-col gap-3 rounded-card bg-gray p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <p className="flex-1 text-small text-muted">
          {items.length ? (
            <>
              <span className="font-semibold text-navy">{countLabel(items.length)}</span> saved. They go with your decision.
            </>
          ) : (
            <>
              Open a direction to look closer and point at details{" "}
              <span className="hidden sm:inline">
                (<Kbd>C</Kbd> to comment)
              </span>
              .
            </>
          )}
        </p>
        <div className="flex">{rebuildButton}</div>
      </div>

      <FocusView
        directions={directions}
        index={focus}
        onIndex={setFocus}
        onClose={close}
        enterClip={clips.enter}
        exitClip={clips.exit}
        title={roundTitle}
        comments={items}
        editable
        actions={{ add, edit, remove }}
        hovered={hovered}
        onHover={setHovered}
        onChoose={choose}
        rebuild={rebuildButton}
      />

      <ApproveDialog open={approveOpen} onOpenChange={setApproveOpen} direction={choosing} directions={directions} comments={items} decision={decision} />
      <RebuildSheet open={rebuildOpen} onOpenChange={setRebuildOpen} rebuildsUsed={rebuildsUsed} comments={items} decision={decision} />
    </div>
  );
}

function RebuildButton({ left, onClick, className }: { left: number; onClick: () => void; className?: string }) {
  if (left > 0) {
    return (
      <Button variant="outline" onClick={onClick} className={className}>
        None of these — rebuild
      </Button>
    );
  }
  return (
    <Tooltip content="You've used both rebuilds. Choose a direction, or write to us.">
      {/* A disabled button gets no pointer events; the wrapper keeps the explanation reachable. */}
      <span tabIndex={0} className={cn("inline-flex rounded-full", className)} aria-label="No rebuilds left. Choose a direction, or write to us.">
        <Button variant="outline" disabled className="pointer-events-none w-full" tabIndex={-1}>
          No rebuilds left
        </Button>
      </span>
    </Tooltip>
  );
}

function DirectionCard({
  direction,
  index,
  count,
  artRef,
  onOpen,
  onChoose,
  readOnlyNote,
}: {
  direction: DirectionSnapshot;
  index: number;
  count: number;
  artRef?: (el: HTMLElement | null) => void;
  onOpen: () => void;
  onChoose?: () => void;
  readOnlyNote?: string;
}) {
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
    <article className="flex w-full flex-col gap-4 rounded-card bg-gray p-3 pb-4">
      <button
        type="button"
        ref={artRef}
        onClick={onOpen}
        onPointerEnter={startCycle}
        onPointerLeave={stopCycle}
        onFocus={startCycle}
        onBlur={stopCycle}
        aria-label={`Open direction ${index + 1}: ${direction.title}`}
        className="group relative grid h-[clamp(280px,48vh,520px)] w-full place-items-center rounded-tile bg-white/70 p-4 transition-[transform,background-color] duration-200 ease-out [container-type:size] hover:bg-white active:scale-[0.99]"
      >
        <CreativeFrame
          path={direction.path}
          format={direction.format}
          lang={direction.lang}
          scene={scenes[scene] ?? null}
          poster={direction.keyframeSvg}
          title={`${direction.title}${scenes.length > 1 ? `, scene ${scene + 1}` : ""}`}
          className="rounded-tile-sm shadow-pop"
          style={containStyle(direction.format)}
        />
        {count > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-navy px-2.5 py-1 text-caption font-semibold tabular-nums text-white shadow-pop">
            {countLabel(count)}
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1.5 px-2">
        <div className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-navy text-caption font-semibold tabular-nums text-white">{index + 1}</span>
          <h3 className="text-title-sm font-semibold">{direction.title}</h3>
        </div>
        {direction.idea && <p className="text-body text-muted">{direction.idea}</p>}
        {direction.studioNote && (
          <p className="text-small">
            <span className="font-semibold">From us · </span>
            {direction.studioNote}
          </p>
        )}
        {scenes.length > 1 && (
          <div className="mt-1 flex items-center gap-2">
            <span className="flex gap-1" aria-hidden="true">
              {scenes.map((s, i) => (
                <span key={s} className={cn("h-1 rounded-full transition-all duration-300", i === scene ? "w-5 bg-navy" : "w-2 bg-mist")} />
              ))}
            </span>
            <span className="text-caption text-muted">
              {scenes.length} scenes · {formatInfo(direction.format).label}
            </span>
          </div>
        )}
      </div>
      {onChoose ? (
        <div className="flex gap-2 px-1">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onOpen}>
            Look closer
          </Button>
          <Button size="sm" className="flex-1" onClick={onChoose}>
            Choose this direction
          </Button>
        </div>
      ) : (
        readOnlyNote && <p className="px-2 text-caption font-semibold text-navy">{readOnlyNote}</p>
      )}
    </article>
  );
}

/** Earlier rounds, read-only, with what was said (spec §6.6 "Later rounds"). */
export function EarlierRounds({ rounds, comments, campaignName, approvedItemId }: { rounds: DeliveryView[]; comments: CommentView[]; campaignName: string; approvedItemId: string | null }) {
  const [openRound, setOpenRound] = useState<string | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  if (!rounds.length) return null;
  const round = rounds.find((r) => r.id === openRound) ?? null;

  return (
    <section aria-labelledby="rounds-h" className="flex flex-col gap-3">
      <h2 id="rounds-h" className="text-title-sm font-semibold">
        {rounds.length === 1 && rounds[0].response?.decision === "approve" ? "The directions" : "Earlier rounds"}
      </h2>
      <ul className="flex flex-col gap-2">
        {rounds.map((r) => {
          const said = comments.filter((c) => c.deliveryId === r.id).length;
          const open = openRound === r.id;
          return (
            <li key={r.id} className="rounded-tile bg-gray">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenRound(open ? null : r.id)}
                className="flex w-full items-center gap-4 rounded-tile p-3 text-left transition-colors hover:bg-gray-strong/70 sm:p-4"
              >
                <span className="flex -space-x-3" aria-hidden="true">
                  {r.directions.slice(0, 3).map((d) => (
                    <span key={d.id} className="relative size-10 overflow-hidden rounded-[12px] bg-white ring-2 ring-gray">
                      {svgDataUri(d.keyframeSvg) && (
                        // eslint-disable-next-line @next/next/no-img-element -- keyframe SVG as an inert image
                        <img src={svgDataUri(d.keyframeSvg)!} alt="" className="absolute inset-0 size-full object-cover" />
                      )}
                    </span>
                  ))}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-semibold">Round {r.round}</span>
                  <span className="truncate text-small text-muted">{outcome(r, approvedItemId)}{said ? ` · ${countLabel(said).toLowerCase()}` : ""}</span>
                </span>
                <span className={cn("text-small font-medium text-navy transition-transform", open && "rotate-180")} aria-hidden="true">
                  ▾
                </span>
              </button>
              {open && (
                <motion.ul initial="hidden" animate="show" variants={stagger(0.05)} className="grid gap-4 px-3 pb-4 sm:grid-cols-3 sm:px-4">
                  {r.directions.map((d, i) => (
                    <motion.li key={d.id} variants={fadeUp} className="flex">
                      <DirectionCard
                        direction={d}
                        index={i}
                        count={comments.filter((c) => c.deliveryId === r.id && c.itemId === d.id).length}
                        onOpen={() => setFocus(i)}
                        readOnlyNote={r.response?.decision === "approve" && r.response.itemId === d.id ? "Your choice" : undefined}
                      />
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </li>
          );
        })}
      </ul>
      {round && (
        <FocusView
          directions={round.directions}
          index={focus}
          onIndex={setFocus}
          onClose={() => setFocus(null)}
          enterClip={FULL_CLIP}
          exitClip={FULL_CLIP}
          title={`${campaignName} · Round ${round.round}`}
          comments={comments.filter((c) => c.deliveryId === round.id)}
          editable={false}
          hovered={hovered}
          onHover={setHovered}
        />
      )}
    </section>
  );
}

function outcome(r: DeliveryView, approvedItemId: string | null): string {
  if (r.response?.decision === "approve") {
    const d = r.directions.find((x) => x.id === (r.response?.itemId ?? approvedItemId));
    return d ? `You chose ${d.title}` : "You chose a direction";
  }
  if (r.response?.decision === "rebuild") return r.response.reason ? `You asked for new ones: “${r.response.reason}”` : "You asked for new directions";
  if (r.status === "superseded") return "Replaced by a newer round";
  return "Waiting for your decision";
}
