import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Kicker, title, one-line lead (spec §6). The primary action sits at the end, where the eye lands. */
export function PageHeader({
  kicker,
  title,
  lead,
  actions,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5 pb-8 pt-10 sm:flex-row sm:items-end sm:justify-between sm:pt-14", className)}>
      <div className="flex max-w-3xl flex-col gap-3">
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 className="text-title font-semibold sm:text-display">{title}</h1>
        {lead && <p className="text-lead text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Page content width and gutters, shared by every screen. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[var(--page-max)] px-4 pb-24 sm:px-[var(--gutter)]", className)}>{children}</div>;
}
