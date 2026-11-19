"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";

/**
 * A number that counts to its new value (counts, sizes, totals). Tabular figures
 * so neighbours don't shift. Screen readers get the final value only.
 */
const defaultFormat = (n: number) => Math.round(n).toLocaleString("en-US");

export function CountUp({
  value,
  format = defaultFormat,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: DURATION.slow + 0.2,
      ease: EASE,
      onUpdate: (n) => {
        el.textContent = format(n);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, format, reduce]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      <span ref={ref} aria-hidden="true">
        {format(0)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
