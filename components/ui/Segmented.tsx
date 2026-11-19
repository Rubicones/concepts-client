"use client";

import { useId, type ReactNode } from "react";
import { Tabs as RTabs, ToggleGroup } from "radix-ui";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { LAYOUT } from "@/lib/motion";

/** Segmented control: one value always chosen; the indicator slides between options. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const layoutId = useId();
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("inline-flex rounded-full bg-gray p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "relative rounded-full font-medium transition-colors duration-150",
            size === "sm" ? "h-7 px-3 text-small" : "h-9 px-4 text-body",
            value === o.value ? "text-navy" : "text-muted hover:text-navy",
            "disabled:opacity-40",
          )}
        >
          {value === o.value && (
            <motion.span layoutId={layoutId} transition={LAYOUT} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgb(12_43_63/0.12)]" />
          )}
          <span className="relative">{o.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** Tabs with a sliding underline. Content panels are Radix tabpanels (keyboard: ←/→, Home/End). */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: ReactNode; count?: number; content: ReactNode }[];
  label: string;
  className?: string;
}) {
  const layoutId = useId();
  return (
    <RTabs.Root value={value} onValueChange={(v) => onChange(v as T)} className={className}>
      <RTabs.List aria-label={label} className="flex gap-6 border-b border-line">
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              "relative -mb-px flex h-11 items-center gap-2 text-body font-medium transition-colors duration-150",
              value === t.value ? "text-navy" : "text-muted hover:text-navy",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-gray px-1.5 text-caption tabular-nums text-muted">{t.count}</span>
            )}
            {value === t.value && (
              <motion.span layoutId={layoutId} transition={LAYOUT} className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-navy" />
            )}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="pt-5 focus-visible:outline-none data-[state=active]:animate-fade-in">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}
