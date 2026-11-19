import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

/**
 * Sticky translucent top bar (spec §6): logo · brand · [save status] · account.
 * Slots keep it a server component; interactive parts are client islands.
 */
export function TopBar({
  brand,
  status,
  actions,
  account,
  className,
}: {
  brand?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  account?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-white",
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-[var(--page-max)] items-center gap-3 px-4 sm:gap-4 sm:px-[var(--gutter)]">
        <Link href="/" aria-label="Toggle Concepts — home" className="shrink-0 rounded-tag text-navy">
          <Logo className="h-4 w-auto" />
        </Link>
        {brand && (
          <>
            <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />
            <div className="min-w-0 truncate text-body font-medium">{brand}</div>
          </>
        )}
        <div className="flex-1" />
        {status && <div className="hidden sm:block">{status}</div>}
        {/* Pages that autosave portal their "Saving… / Saved" here. */}
        <div id="topbar-status" className="hidden sm:block" />
        {actions}
        {account}
      </div>
    </header>
  );
}
