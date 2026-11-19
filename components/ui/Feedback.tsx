import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { StatusTone } from "@/lib/client-status";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

/** Give it the exact size of what it stands in for: skeletons must not shift layout. */
export function Skeleton({ className, style, round }: { className?: string; style?: CSSProperties; round?: boolean }) {
  return <span aria-hidden="true" style={style} className={cn("skeleton block", round ? "rounded-full" : "rounded-input", className)} />;
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

/** Determinate bar (0–1) eases between values; omit `value` for indeterminate. */
export function ProgressBar({
  value,
  label,
  tone = "navy",
  className,
}: {
  value?: number;
  label: string;
  tone?: "navy" | "ok" | "err" | "orange";
  className?: string;
}) {
  const v = value === undefined ? undefined : Math.min(1, Math.max(0, value));
  const fill = { navy: "bg-navy", ok: "bg-ok", err: "bg-err", orange: "bg-orange" }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v === undefined ? undefined : Math.round(v * 100)}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-gray", className)}
    >
      {v === undefined ? (
        <span className={cn("skeleton absolute inset-0 opacity-60", fill)} />
      ) : (
        <span
          className={cn("absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-[420ms] ease-out", fill)}
          style={{ transform: `scaleX(${v})` }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status pill                                                         */
/* ------------------------------------------------------------------ */

const toneStyles: Record<StatusTone, { pill: string; dot: string }> = {
  neutral: { pill: "bg-gray text-navy", dot: "bg-muted" },
  progress: { pill: "bg-ice text-navy shadow-[inset_0_0_0_1px_var(--color-sky)]", dot: "bg-hover" },
  attention: { pill: "bg-orange-soft text-navy", dot: "bg-orange" },
  ok: { pill: "bg-ok-soft text-ok", dot: "bg-ok" },
  muted: { pill: "bg-gray text-muted", dot: "bg-mist" },
};

/** Client status. Takes the label from lib/client-status, never an internal status. */
export function StatusPill({ label, tone, className }: { label: string; tone: StatusTone; className?: string }) {
  const s = toneStyles[tone];
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-full px-3 text-small font-medium transition-colors duration-200",
        s.pill,
        className,
      )}
    >
      <span className="relative flex size-2" aria-hidden="true">
        {tone === "attention" && <span className="absolute inset-0 animate-ping rounded-full bg-orange opacity-40 motion-reduce:hidden" />}
        <span className={cn("relative size-2 rounded-full", s.dot)} />
      </span>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar / initials                                                   */
/* ------------------------------------------------------------------ */

const avatarTones = ["bg-sky text-navy", "bg-navy text-white", "bg-mist text-navy", "bg-gray text-navy", "bg-hover text-white"];

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      role="img"
      aria-label={name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={cn("inline-grid shrink-0 select-none place-items-center rounded-full font-semibold", avatarTones[h % avatarTones.length], className)}
    >
      <span aria-hidden="true">{initialsOf(name)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

/** Says what will appear here and what to do, warmly and briefly. Never a blank box. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
  tone = "gray",
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  tone?: "gray" | "sky" | "white";
}) {
  const bg = { gray: "bg-gray", sky: "light-gradient", white: "bg-white shadow-[inset_0_0_0_1px_var(--color-line)]" }[tone];
  return (
    <div className={cn("flex flex-col items-center gap-4 rounded-card px-6 py-12 text-center sm:py-16", bg, className)}>
      {icon && <div className="grid size-12 place-items-center rounded-full bg-white text-navy shadow-pop">{icon}</div>}
      <div className="flex max-w-md flex-col gap-1.5">
        <h3 className="text-title-sm font-semibold">{title}</h3>
        {children && <p className="text-body text-muted">{children}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Banner                                                              */
/* ------------------------------------------------------------------ */

export type BannerTone = "info" | "attention" | "ok" | "err";

/** Page-level message. "attention" is the orange "needs you" accent. */
export function Banner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: BannerTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles: Record<BannerTone, { box: string; icon: ReactNode; iconBox: string }> = {
    info: { box: "bg-ice shadow-[inset_0_0_0_1px_var(--color-sky)]", icon: <InfoIcon size={16} />, iconBox: "bg-sky text-navy" },
    attention: { box: "bg-orange-soft shadow-[inset_3px_0_0_var(--color-orange)]", icon: <AlertIcon size={16} />, iconBox: "bg-orange text-white" },
    ok: { box: "bg-ok-soft", icon: <CheckIcon size={16} strokeWidth={2.2} />, iconBox: "bg-ok text-white" },
    err: { box: "bg-err-soft", icon: <AlertIcon size={16} />, iconBox: "bg-err text-white" },
  };
  const s = styles[tone];
  return (
    <div role={tone === "err" ? "alert" : "status"} className={cn("flex flex-col gap-3 rounded-tile p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5", s.box, className)}>
      <div className="flex flex-1 items-start gap-3">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", s.iconBox)} aria-hidden="true">
          {s.icon}
        </span>
        <div className="flex flex-col gap-0.5 pt-0.5">
          <p className="text-body font-semibold">{title}</p>
          {children && <div className="text-small text-muted">{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 pl-10 sm:pl-0">{action}</div>}
    </div>
  );
}
