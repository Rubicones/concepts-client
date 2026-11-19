"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CampaignKind } from "@/lib/brief";

/**
 * Tiny illustrations for the three kinds (spec §6.5): a still frame, a frame
 * that breathes in a loop, and frames that follow one another like a story.
 * Brand book: thin lines and format cards, calm motion, no bounce.
 */
export function KindIllustration({ kind, active }: { kind: CampaignKind; active: boolean }) {
  const reduce = useReducedMotion();
  const loop = !reduce && active;
  const stroke = "currentColor";
  return (
    <svg viewBox="0 0 160 90" className="h-full w-full text-navy" aria-hidden="true">
      {kind === "poster" && (
        <g>
          <rect x="58" y="12" width="44" height="66" rx="6" fill="#fff" stroke={stroke} strokeWidth="1.5" />
          <rect x="64" y="20" width="32" height="26" rx="3" fill="var(--color-sky)" />
          <rect x="64" y="52" width="24" height="3" rx="1.5" fill={stroke} />
          <rect x="64" y="59" width="16" height="3" rx="1.5" fill="var(--color-mist)" />
          <rect x="64" y="67" width="14" height="5" rx="2.5" fill="var(--color-orange)" />
        </g>
      )}
      {kind === "single" && (
        <g>
          <rect x="58" y="12" width="44" height="66" rx="6" fill="#fff" stroke={stroke} strokeWidth="1.5" />
          <motion.circle
            cx="80"
            cy="38"
            r="12"
            fill="var(--color-sky)"
            animate={loop ? { r: [10, 14, 10] } : { r: 12 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }}
          />
          <rect x="66" y="60" width="28" height="3" rx="1.5" fill={stroke} />
          <motion.path
            d="M108 45 a 14 14 0 1 1 -4 -10"
            fill="none"
            stroke="var(--color-mist)"
            strokeWidth="1.5"
            strokeLinecap="round"
            animate={loop ? { rotate: 360 } : { rotate: 0 }}
            style={{ originX: "94px", originY: "45px" }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        </g>
      )}
      {kind === "multi" && (
        <g>
          {[0, 1, 2].map((i) => (
            <motion.g
              key={i}
              animate={loop ? { opacity: [0.35, 1, 0.35] } : { opacity: i === 1 ? 1 : 0.5 }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: [0.65, 0, 0.35, 1] }}
            >
              <rect x={22 + i * 42} y="20" width="32" height="50" rx="5" fill="#fff" stroke={stroke} strokeWidth="1.5" />
              <rect x={27 + i * 42} y="26" width="22" height="18" rx="2.5" fill={i === 2 ? "var(--color-orange)" : "var(--color-sky)"} />
              <rect x={27 + i * 42} y="50" width="16" height="2.5" rx="1.25" fill={stroke} />
            </motion.g>
          ))}
          <path d="M56 45h6M98 45h6" stroke="var(--color-mist)" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

/** Small static mark for placeholders. */
export function KindGlyph({ kind }: { kind: CampaignKind }) {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {kind === "poster" && <rect x="14" y="8" width="20" height="32" rx="3" />}
      {kind === "single" && (
        <>
          <rect x="14" y="8" width="20" height="32" rx="3" />
          <circle cx="24" cy="20" r="5" />
        </>
      )}
      {kind === "multi" && (
        <>
          <rect x="4" y="12" width="12" height="24" rx="2" />
          <rect x="18" y="12" width="12" height="24" rx="2" />
          <rect x="32" y="12" width="12" height="24" rx="2" />
        </>
      )}
    </svg>
  );
}
