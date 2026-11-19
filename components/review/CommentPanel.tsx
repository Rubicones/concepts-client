"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import type { CommentView } from "@/campaign/review";
import { MAX_COMMENT } from "@/campaign/review";
import { Button, IconButton } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Tooltip";
import { isTemp } from "./useComments";
import type { NumberedPin } from "./PinLayer";

/**
 * The comments of one direction (spec §6.6): pins in number order, then general
 * comments, then the box for a new general comment. Hovering an item lights its
 * pin and the reverse. Drafts are editable and deletable until the decision.
 */
export function CommentPanel({
  pins,
  general,
  editable,
  hovered,
  onHover,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onAddGeneral,
  sceneLabel,
  otherCount,
  commentMode,
}: {
  pins: NumberedPin[];
  general: CommentView[];
  editable: boolean;
  hovered: string | null;
  onHover: (id: string | null) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  onAddGeneral: (body: string) => Promise<boolean>;
  sceneLabel: (scene: string | null) => string | null;
  otherCount: number;
  commentMode: boolean;
}) {
  const empty = pins.length === 0 && general.length === 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 lg:px-6">
        {empty ? (
          <div className="flex flex-col items-start gap-2 py-2 text-small text-muted">
            {editable ? (
              <>
                <p>No comments on this direction yet.</p>
                <p className="flex flex-wrap items-center gap-1.5">
                  Press <Kbd>C</Kbd> or “Comment”, then click the spot you mean.
                </p>
              </>
            ) : (
              <p>No comments on this direction.</p>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {[...pins, ...general].map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  n={"n" in c ? (c as NumberedPin).n : null}
                  meta={sceneLabel(c.scene)}
                  editable={editable && c.state === "draft"}
                  lit={hovered === c.id || selected === c.id}
                  onHover={onHover}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  scrollIntoView={selected === c.id}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
        {otherCount > 0 && (
          <p className="mt-4 text-caption text-muted">
            {otherCount} more on the other directions. All of them go with your decision.
          </p>
        )}
      </div>
      {editable && <GeneralBox onAdd={onAddGeneral} quiet={commentMode} />}
    </div>
  );
}

function CommentItem({
  comment,
  n,
  meta,
  editable,
  lit,
  onHover,
  onSelect,
  onEdit,
  onDelete,
  scrollIntoView,
}: {
  comment: CommentView;
  n: number | null;
  meta: string | null;
  editable: boolean;
  lit: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string, body: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  scrollIntoView: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body);
  const ref = useRef<HTMLLIElement>(null);
  const saving = isTemp(comment.id);

  useEffect(() => {
    if (scrollIntoView) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [scrollIntoView]);

  async function save() {
    const body = text.trim();
    if (!body) return;
    if (body === comment.body) return setEditing(false);
    setEditing(false);
    if (!(await onEdit(comment.id, body))) setText(comment.body);
  }

  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
      transition={SPRING}
      onPointerEnter={() => onHover(comment.id)}
      onPointerLeave={() => onHover(null)}
      className={cn("group relative flex gap-3 rounded-tile-sm p-3 transition-colors duration-150", lit ? "bg-sky/45" : "hover:bg-gray")}
    >
      {n !== null ? (
        <button
          type="button"
          onClick={() => onSelect(comment.id)}
          aria-label={`Show comment ${n} on the picture`}
          className="grid size-7 shrink-0 place-items-center rounded-full rounded-bl-[4px] bg-navy text-caption font-semibold tabular-nums text-white shadow-pin"
        >
          {n}
        </button>
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gray-strong text-muted" aria-hidden="true">
          <ChatGlyph />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              value={text}
              maxLength={MAX_COMMENT}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void save();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setText(comment.body);
                  setEditing(false);
                }
              }}
              aria-label="Edit your comment"
              className="w-full resize-none rounded-input bg-white px-3 py-2 text-body leading-[22px] shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus-visible:shadow-ring [field-sizing:content] min-h-[60px] max-h-48"
            />
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => (setText(comment.body), setEditing(false))}>
                Cancel
              </Button>
              <Button size="sm" disabled={!text.trim()} onClick={() => void save()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className={cn("whitespace-pre-wrap break-words text-body", saving && "text-muted")}>{comment.body}</p>
        )}
        <div className="flex items-center gap-2 text-caption text-muted">
          <span>{n === null ? "On the whole direction" : meta ?? "On the picture"}</span>
          {saving && <span>· Saving…</span>}
          {comment.state === "sent" && <span>· Sent</span>}
          {comment.state === "resolved" && <span>· Done</span>}
        </div>
      </div>
      {editable && !editing && !saving && (
        <div className="flex shrink-0 gap-0.5 self-start opacity-100 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
          <IconButton size="sm" variant="ghost" label="Edit comment" onClick={() => setEditing(true)}>
            <EditGlyph />
          </IconButton>
          <IconButton size="sm" variant="ghost" label="Delete comment" onClick={() => onDelete(comment.id)}>
            <TrashGlyph />
          </IconButton>
        </div>
      )}
    </motion.li>
  );
}

function GeneralBox({ onAdd, quiet }: { onAdd: (body: string) => Promise<boolean>; quiet: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setText("");
    const ok = await onAdd(body);
    if (!ok) setText(body);
    setBusy(false);
  }

  return (
    <div className={cn("border-t border-line p-4 transition-opacity lg:px-6", quiet && "opacity-60 focus-within:opacity-100")}>
      <label htmlFor="general-comment" className="sr-only">
        A comment on the whole direction
      </label>
      <div className="flex items-end gap-2 rounded-input bg-gray p-1.5 pl-3 focus-within:shadow-ring">
        <textarea
          id="general-comment"
          value={text}
          maxLength={MAX_COMMENT}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="A comment on the whole direction…"
          className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-body leading-[22px] outline-none placeholder:text-muted [field-sizing:content]"
        />
        <Button size="sm" disabled={!text.trim()} state={busy ? "loading" : "idle"} onClick={() => void send()}>
          Add
        </Button>
      </div>
    </div>
  );
}

function EditGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

function ChatGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 18.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-3 2.5z" />
    </svg>
  );
}
