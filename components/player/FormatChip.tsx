"use client";

import { cn } from "@/lib/cn";
import { formatInfo } from "@/lib/forma-constants";

/** A format drawn to its real ratio, so 9:16 and 16:9 read at a glance (spec §6.5, §7). */
export function FormatGlyph({ format, size = 18, className }: { format: string; size?: number; className?: string }) {
  const f = formatInfo(format);
  const r = f.w / f.h;
  const w = r >= 1 ? size : Math.round(size * r);
  const h = r >= 1 ? Math.round(size / r) : size;
  return (
    <span aria-hidden="true" className={cn("inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <span className="rounded-[3px] border-[1.5px] border-current" style={{ width: w, height: h }} />
    </span>
  );
}

export function FormatChip({
  format,
  selected,
  onSelect,
  showName,
  size = "md",
  multiple,
  className,
}: {
  format: string;
  selected: boolean;
  onSelect: () => void;
  showName?: boolean;
  size?: "sm" | "md";
  /** Checkbox semantics (pick several) instead of radio. */
  multiple?: boolean;
  className?: string;
}) {
  const f = formatInfo(format);
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      title={f.name}
      onClick={onSelect}
      className={cn(
        "inline-flex select-none items-center gap-2 rounded-full font-medium tabular-nums transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98]",
        size === "sm" ? "h-8 px-3 text-small" : "h-10 px-4 text-body",
        selected
          ? "bg-navy text-white"
          : "bg-white text-navy shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-gray/60 hover:shadow-[inset_0_0_0_1px_var(--color-mist)]",
        className,
      )}
    >
      <FormatGlyph format={format} size={size === "sm" ? 14 : 16} />
      {f.label}
      {showName && <span className={selected ? "text-white/70" : "text-muted"}>{f.name}</span>}
    </button>
  );
}

/** Radio group wrapper: arrow keys move between chips. */
export function ChoiceRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-2", className)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        if (i < 0) return;
        e.preventDefault();
        e.stopPropagation();
        const next = items[(i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
        next.focus();
        next.click();
      }}
    >
      {children}
    </div>
  );
}

/** Small text choice (language, length) with the same radio semantics. */
export function ChoicePill({ selected, onSelect, children, title }: { selected: boolean; onSelect: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={title}
      onClick={onSelect}
      className={cn(
        "inline-flex h-8 select-none items-center rounded-full px-3 text-small font-medium tabular-nums transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98]",
        selected ? "bg-navy text-white" : "bg-gray text-navy hover:bg-gray-strong",
      )}
    >
      {children}
    </button>
  );
}
