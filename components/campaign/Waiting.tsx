import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * "We're working" (spec §6.4): a slow gradient from the hero palette and one line
 * of what happens next. No fake percentages, no ETAs. Reduced motion: still.
 */
export function WaitingState({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-card px-6 py-12 text-white sm:px-10 sm:py-16", className)}>
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-[waiting-drift_14s_ease-in-out_infinite_alternate] bg-[length:200%_200%] motion-reduce:animate-none"
        style={{ backgroundImage: "linear-gradient(135deg,#8EBFD8 0%,#6F9DB7 22%,#38596F 48%,#0C2B3F 72%,#1D4A66 100%)" }}
      />
      <div aria-hidden="true" className="absolute -right-16 -top-16 size-64 rounded-full bg-sky/20 blur-3xl" />
      <div className="relative flex max-w-xl flex-col gap-3">
        <span className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.08em] text-white/80">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-sky opacity-60 motion-reduce:hidden" />
            <span className="relative size-2 rounded-full bg-sky" />
          </span>
          In progress
        </span>
        <h2 className="text-title font-semibold">{title}</h2>
        {children && <div className="text-lead text-white/85">{children}</div>}
      </div>
    </div>
  );
}
