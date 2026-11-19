import type { Transition, Variants } from "motion/react";

/**
 * Motion presets (spec §2.2). Use these instead of ad-hoc numbers so the
 * whole product moves the same way: calm, precise, no bounce (brand book §17).
 */

/** The prototype's easing. */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  /** Hover, press, toggle: 120–200 ms. */
  feedback: 0.16,
  /** Surfaces and layout: 240–420 ms. */
  surface: 0.32,
  slow: 0.42,
} as const;

/** Spring for sheets, dialogs, pins: firm, critically damped, no overshoot you can see. */
export const SPRING: Transition = { type: "spring", stiffness: 380, damping: 32, mass: 1 };
/** Layout changes (FLIP). */
export const LAYOUT: Transition = { type: "spring", stiffness: 420, damping: 38 };

export const feedback: Transition = { duration: DURATION.feedback, ease: EASE };
export const surface: Transition = { duration: DURATION.surface, ease: EASE };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: surface },
};

/** Lists: children enter with a short stagger. */
export const stagger = (step = 0.04, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const PRESS_SCALE = 0.98;
