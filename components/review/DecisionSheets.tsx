"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { MAX_REBUILDS } from "@/lib/limits";
import { countLabel, REBUILD_REASONS, type CommentView } from "@/campaign/review";
import type { DirectionSnapshot } from "@/campaign/types";
import { approveDirection, requestRebuild } from "@/app/actions/review";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup } from "@/components/ui/Chip";
import { Dialog, Sheet } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon } from "@/components/ui/icons";
import { svgDataUri } from "@/components/player/svg";
import { useMediaQuery } from "./useComments";

interface Decision {
  campaignId: string;
  version: number;
  deliveryId: string;
}

/** After a decision: a calm confirmation, then the campaign page moves on. */
function useSent() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);
  function markSent() {
    setSent(true);
    timer.current = window.setTimeout(() => router.refresh(), 1800);
  }
  return { sent, markSent, continueNow: () => router.refresh() };
}

function SentState({ title, children, onContinue }: { title: string; children: React.ReactNode; onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center" role="status">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING}
        className="grid size-14 place-items-center rounded-full bg-ok text-white"
        aria-hidden="true"
      >
        <CheckIcon size={26} strokeWidth={2.4} />
      </motion.span>
      <div className="flex flex-col gap-1.5">
        <p className="text-title-sm font-semibold">{title}</p>
        <p className="text-body text-muted">{children}</p>
      </div>
      <Button variant="secondary" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

function useDecide(decision: Decision) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  function decide(fn: () => Promise<{ ok: true } | { ok: false; error: string; code?: string }>, onDone: () => void) {
    start(async () => {
      const r = await fn();
      if (r.ok) onDone();
      else if (r.code === "conflict") toast({ title: r.error, tone: "err", action: { label: "Refresh", onClick: () => router.refresh() } });
      else toast({ title: r.error, tone: "err" });
    });
  }
  return { pending, decide, decision };
}

/** Grouped by direction, in the review's order: what will be sent. */
function CommentSummary({ directions, comments }: { directions: DirectionSnapshot[]; comments: CommentView[] }) {
  const groups = directions.map((d, i) => ({ d, i, list: comments.filter((c) => c.itemId === d.id) })).filter((g) => g.list.length);
  if (!groups.length) return <p className="text-small text-muted">No comments. You can add them before you decide.</p>;
  return (
    <div className="flex max-h-56 flex-col gap-4 overflow-y-auto rounded-tile-sm bg-gray p-4">
      {groups.map(({ d, i, list }) => (
        <div key={d.id} className="flex flex-col gap-2">
          <p className="kicker">
            {i + 1} · {d.title}
          </p>
          <ul className="flex flex-col gap-1.5">
            {list.map((c) => (
              <li key={c.id} className="flex gap-2 text-small">
                <span className="text-muted" aria-hidden="true">
                  {c.x === null ? "—" : "•"}
                </span>
                <span className="line-clamp-3 whitespace-pre-wrap break-words">{c.body}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ApproveDialog({
  open,
  onOpenChange,
  direction,
  directions,
  comments,
  decision,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: DirectionSnapshot | null;
  directions: DirectionSnapshot[];
  comments: CommentView[];
  decision: Decision;
}) {
  const { pending, decide } = useDecide(decision);
  const { sent, markSent, continueNow } = useSent();
  const still = svgDataUri(direction?.keyframeSvg);
  const n = comments.length;

  if (!direction) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !pending && !sent && onOpenChange(o)}
      dismissible={!pending && !sent}
      size="lg"
      title={sent ? "Approved" : `Choose ${direction.title}?`}
      hideTitle={sent}
      description={sent ? undefined : "We'll build the final in every format from this direction. Your comments go to the team with it."}
      footer={
        sent ? undefined : (
          <>
            <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button
              state={pending ? "loading" : "idle"}
              onClick={() =>
                decide(
                  () => approveDirection(decision.campaignId, decision.version, decision.deliveryId, direction.id),
                  markSent,
                )
              }
            >
              Approve{n ? ` with ${countLabel(n).toLowerCase()}` : ""}
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <SentState title={`You chose ${direction.title}.`} onContinue={continueNow}>
          We&apos;re building the final now. You&apos;ll get an email when it&apos;s ready.
        </SentState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          <div className="relative aspect-square overflow-hidden rounded-tile-sm bg-gray">
            {still && (
              // eslint-disable-next-line @next/next/no-img-element -- keyframe SVG as an inert image
              <img src={still} alt={`${direction.title}, still`} className="absolute inset-0 size-full object-contain" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-small font-semibold">{n ? `${countLabel(n)} will be sent` : "Comments"}</p>
            <CommentSummary directions={directions} comments={comments} />
            <p className="text-caption text-muted">This is final: after approving, the other directions close.</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function RebuildSheet({
  open,
  onOpenChange,
  rebuildsUsed,
  comments,
  decision,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rebuildsUsed: number;
  comments: CommentView[];
  decision: Decision;
}) {
  const wide = useMediaQuery("(min-width: 640px)");
  const { pending, decide } = useDecide(decision);
  const { sent, markSent, continueNow } = useSent();
  const [chips, setChips] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const left = Math.max(0, MAX_REBUILDS - rebuildsUsed);
  const needsText = chips.includes("Other") || chips.length === 0;
  const reason = [chips.filter((c) => c !== "Other").join(", "), text.trim()].filter(Boolean).join(". ");
  const invalid = needsText && !text.trim();

  function toggle(c: string) {
    setChips((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !pending && !sent && onOpenChange(o)}
      dismissible={!pending && !sent}
      side={wide ? "right" : "bottom"}
      title={sent ? "New directions requested" : "None of these feel right?"}
      hideTitle={sent}
      description={
        sent ? undefined : (
          <>
            We&apos;ll make three new directions. You can do this up to {MAX_REBUILDS} times per campaign —{" "}
            <strong className="font-semibold text-navy">{left} left</strong>.
          </>
        )
      }
      footer={
        sent ? undefined : (
          <>
            <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button
              state={pending ? "loading" : "idle"}
              onClick={() => {
                setTried(true);
                if (invalid || !reason) return;
                decide(() => requestRebuild(decision.campaignId, decision.version, decision.deliveryId, reason), markSent);
              }}
            >
              Ask for new directions
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <SentState title="Thanks. We're on it." onContinue={continueNow}>
          We&apos;ll make three new directions with your notes. You&apos;ll get an email when they&apos;re ready.
        </SentState>
      ) : (
        <div className="flex flex-col gap-6">
          <ChipGroup label="What didn't work?" hint="Pick any">
            {REBUILD_REASONS.map((r) => (
              <Chip key={r} selected={chips.includes(r)} onSelectedChange={() => toggle(r)}>
                {r}
              </Chip>
            ))}
          </ChipGroup>
          <div className="flex flex-col gap-2">
            <label htmlFor="rebuild-reason" className="text-small font-semibold">
              In a few words {needsText ? "" : <span className="font-normal text-muted">(optional)</span>}
            </label>
            <Textarea
              id="rebuild-reason"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={3800}
              minLines={3}
              invalid={tried && invalid}
              aria-describedby={tried && invalid ? "rebuild-reason-err" : undefined}
              placeholder="e.g. “Closer to our packaging, less abstract.”"
            />
            {tried && invalid && (
              <p id="rebuild-reason-err" className="text-small text-err">
                Tell us in a few words what didn&apos;t work.
              </p>
            )}
          </div>
          <p className={cn("text-small", comments.length ? "text-navy" : "text-muted")}>
            {comments.length ? `${countLabel(comments.length)} go with it.` : "Your comments go with it, if you add any first."}
          </p>
        </div>
      )}
    </Sheet>
  );
}
