"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ToastProvider } from "@/components/ui/Toast";
import { EASE, DURATION } from "@/lib/motion";

/**
 * Client-wide providers. MotionConfig reducedMotion="user" drops transforms and
 * keeps fades when the OS asks for less motion (spec §2.2).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: DURATION.surface, ease: EASE }}>
      <TooltipProvider delayDuration={350} skipDelayDuration={200}>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
