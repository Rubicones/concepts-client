"use client";

import { AnimatePresence, motion } from "motion/react";
import { feedback } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/Spinner";

export type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

const copy: Record<Exclude<SaveState, "idle">, string> = {
  saving: "Saving…",
  saved: "Saved",
  offline: "Offline · saved on this device",
  error: "Couldn't save · retrying",
};

/** "Saving… → Saved", as in the prototype. Announced politely; never steals focus. */
export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  return (
    <div aria-live="polite" className={cn("flex h-6 min-w-24 items-center justify-end text-small text-muted", className)}>
      <AnimatePresence mode="wait" initial={false}>
        {state !== "idle" && (
          <motion.span
            key={state}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={feedback}
            className="inline-flex items-center gap-1.5"
          >
            {state === "saving" ? (
              <Spinner size={12} />
            ) : (
              <i
                aria-hidden="true"
                className={cn("inline-block size-[7px] rounded-full", state === "saved" ? "bg-ok" : state === "error" ? "bg-err" : "bg-mist")}
              />
            )}
            {copy[state]}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
