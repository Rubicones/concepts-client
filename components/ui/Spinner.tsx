import { cn } from "@/lib/cn";

/**
 * Busy indicator. Decorative when inside a control that already says it is busy
 * (aria-busy on the button); pass `label` when it stands alone.
 */
export function Spinner({ size = 16, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex", className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
