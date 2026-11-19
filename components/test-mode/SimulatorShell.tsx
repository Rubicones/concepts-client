"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { ChevronDownIcon } from "@/components/ui/icons";

/** Floating "Test mode · Studio" panel (spec §6.1). Disappears when Forma moderation ships. */
export function SimulatorShell({ badge, children, defaultOpen = false }: { badge?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(380px,calc(100vw-32px))]">
      <motion.div layout transition={SPRING} className="overflow-hidden rounded-tile bg-deep text-white shadow-sheet">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <span className="size-2 rounded-full bg-orange" aria-hidden="true" />
          <span className="flex-1 text-small font-semibold uppercase tracking-[0.06em]">Test mode · Studio</span>
          {badge}
          <ChevronDownIcon size={16} className={cn("transition-transform", open ? "rotate-180" : "")} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/10">
              <div className="flex flex-col gap-3 p-4">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
