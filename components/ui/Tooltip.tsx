"use client";

import type { ReactNode } from "react";
import { Tooltip as RTooltip } from "radix-ui";
import { cn } from "@/lib/cn";

/**
 * Tooltip for supplementary text only. Never the only way to learn something
 * essential: hover isn't available on touch (spec §2.2).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  shortcut,
  open,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
  /** Forced open (styleguide). */
  open?: boolean;
}) {
  return (
    <RTooltip.Root open={open}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50 flex max-w-72 animate-pop-in items-center gap-2 rounded-input bg-deep px-3 py-2 text-small text-white shadow-pop",
          )}
        >
          {content}
          {shortcut && <Kbd tone="dark">{shortcut}</Kbd>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export const TooltipProvider = RTooltip.Provider;

/** Keyboard hint. */
export function Kbd({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] px-1.5 font-sans text-caption font-semibold tabular-nums",
        tone === "dark" ? "bg-white/15 text-white" : "bg-gray text-muted shadow-[inset_0_-1px_0_var(--color-line)]",
      )}
    >
      {children}
    </kbd>
  );
}
