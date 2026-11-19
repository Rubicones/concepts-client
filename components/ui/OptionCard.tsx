"use client";

import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { CheckIcon } from "./icons";
import type { ForcedState } from "./Button";

/**
 * Large selectable card: campaign kind, rebuild reasons with illustration, etc.
 * Use inside OptionCardGroup for radio semantics (arrow keys move between cards).
 */
export interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  media?: ReactNode;
  disabled?: boolean;
  force?: ForcedState;
  multiple?: boolean;
  className?: string;
}

export function OptionCard({ selected, onSelect, title, description, media, disabled, force, multiple, className }: OptionCardProps) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      data-force={force}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col items-start gap-3 rounded-tile bg-white p-5 text-left",
        "transition-[box-shadow,background-color,transform] duration-200 ease-out active:scale-[0.99]",
        "data-[force=focus]:outline-2 data-[force=focus]:outline-offset-2 data-[force=focus]:outline-focus",
        selected
          ? "shadow-[inset_0_0_0_2px_var(--color-navy)]"
          : "shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-mist)] hover:bg-ice/60 data-[force=hover]:bg-ice/60 data-[force=hover]:shadow-[inset_0_0_0_1px_var(--color-mist)]",
        "disabled:opacity-50 disabled:active:scale-100",
        className,
      )}
    >
      {media && <div className="w-full overflow-hidden rounded-tile-sm bg-gray">{media}</div>}
      <div className="flex w-full items-start gap-3 pr-8">
        <div className="flex flex-col gap-1">
          <span className="text-lead font-semibold tracking-[-0.01em]">{title}</span>
          {description && <span className="text-small text-muted">{description}</span>}
        </div>
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "absolute right-4 top-4 grid size-6 place-items-center rounded-full transition-colors duration-150",
          selected ? "bg-navy text-white" : "shadow-[inset_0_0_0_1.5px_var(--color-mist)]",
        )}
      >
        <AnimatePresence initial={false}>
          {selected && (
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={SPRING}>
              <CheckIcon size={14} strokeWidth={2.4} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}

export function OptionCardGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-3", className)}
      onKeyDown={(e) => {
        if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        if (i < 0) return;
        e.preventDefault();
        const next = items[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
        next.focus();
        next.click();
      }}
    >
      {children}
    </div>
  );
}
