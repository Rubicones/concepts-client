"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/motion";
import { CheckIcon } from "./icons";
import type { ForcedState } from "./Button";

/**
 * Toggle chip: the prototype's "Mostly tap, little typing" control.
 * Selected = navy fill; the check slides in so selection is never colour-only.
 */
export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  size?: "sm" | "md";
  icon?: ReactNode;
  force?: ForcedState;
  /** Hide the check (e.g. single-choice groups where the fill is enough with aria-checked). */
  noCheck?: boolean;
  /** "Up to you": dashed until chosen, then sky (the prototype's .chip.decide). */
  decide?: boolean;
  /** At the max: still clickable (it explains), but quieter. */
  dim?: boolean;
  /** On a white card the resting chip is gray (the prototype's .white .chip). */
  onWhite?: boolean;
}

export function Chip({
  selected = false,
  onSelectedChange,
  size = "md",
  icon,
  force,
  noCheck,
  decide,
  dim,
  onWhite,
  className,
  children,
  onClick,
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-selected={selected || undefined}
      data-force={force}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onSelectedChange?.(!selected);
      }}
      className={cn(
        "inline-flex select-none items-center gap-1.5 rounded-full font-medium",
        "transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]",
        "data-[force=active]:scale-[0.98] data-[force=focus]:outline-2 data-[force=focus]:outline-offset-2 data-[force=focus]:outline-focus",
        size === "sm" ? "h-8 px-3 text-small" : "h-10 px-4 text-body",
        selected
          ? decide
            ? "bg-sky text-navy"
            : "bg-navy text-white hover:bg-hover data-[force=hover]:bg-hover"
          : decide
            ? "border border-dashed border-mist bg-white text-navy hover:border-navy/40"
            : onWhite
              ? "bg-gray text-navy hover:bg-gray-strong data-[force=hover]:bg-gray-strong"
              : "bg-white text-navy shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-mist)] hover:bg-gray/50 data-[force=hover]:bg-gray/50",
        dim && !selected && "opacity-40",
        "disabled:opacity-50 disabled:active:scale-100",
        className,
      )}
      {...rest}
    >
      {icon}
      <AnimatePresence initial={false}>
        {selected && !noCheck && (
          <motion.span
            key="check"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={feedback}
            className="-ml-0.5 inline-flex overflow-hidden"
            aria-hidden="true"
          >
            <CheckIcon size={14} strokeWidth={2.4} />
          </motion.span>
        )}
      </AnimatePresence>
      {children}
    </button>
  );
}

/** Group label for chips; announces the max when there is one. */
export function ChipGroup({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-col gap-2", className)}>
      {(label || hint) && (
        <div className="flex items-baseline gap-2">
          {label && <span className="kicker">{label}</span>}
          {hint && <span className="text-caption text-muted">{hint}</span>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Flat, non-clickable label (8 px radius): "clickable = pill, not clickable = flat tag" (brand book §15). */
export function Tag({ children, tone = "gray", className }: { children: ReactNode; tone?: "gray" | "sky" | "navy" | "orange"; className?: string }) {
  const tones = {
    gray: "bg-gray text-navy",
    sky: "bg-sky text-navy",
    navy: "bg-navy text-white",
    orange: "bg-orange-soft text-err",
  };
  return (
    <span className={cn("inline-flex h-6 items-center rounded-tag px-2 text-caption font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
