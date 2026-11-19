import { cn } from "@/lib/cn";
import { RAIL, railState } from "@/campaign/progress";
import type { CampaignStatus } from "@/lib/db-types";
import { CheckIcon } from "@/components/ui/icons";

/** Brief → Directions → Final. Done steps in navy, the current one in orange (spec §6.4). */
export function ProgressRail({ status, className }: { status: CampaignStatus; className?: string }) {
  const { current, done } = railState(status);
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label="Campaign progress">
      {RAIL.map((step, i) => {
        const isDone = done.includes(step.id);
        const isCurrent = current === step.id;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2" aria-current={isCurrent ? "step" : undefined}>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-caption font-semibold transition-colors duration-300",
                isDone && "bg-navy text-white",
                isCurrent && "bg-orange text-white shadow-[0_0_0_4px_var(--color-orange-soft)]",
                !isDone && !isCurrent && "bg-gray text-muted",
              )}
            >
              {isDone ? <CheckIcon size={13} strokeWidth={2.6} /> : i + 1}
            </span>
            <span className={cn("text-small font-medium", isCurrent ? "text-navy" : isDone ? "text-navy" : "text-muted")}>
              {step.label}
              {isDone && <span className="sr-only"> (done)</span>}
              {isCurrent && <span className="sr-only"> (now)</span>}
            </span>
            {i < RAIL.length - 1 && <span aria-hidden="true" className={cn("h-0.5 flex-1 rounded-full transition-colors duration-300", isDone ? "bg-navy" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}

/** The quiet dot row on campaign cards. */
export function ProgressDots({ status }: { status: CampaignStatus }) {
  const { current, done } = railState(status);
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {RAIL.map((s) => (
        <span
          key={s.id}
          className={cn("h-1 rounded-full transition-all duration-300", current === s.id ? "w-5 bg-orange" : done.includes(s.id) ? "w-3 bg-navy" : "w-3 bg-mist")}
        />
      ))}
    </span>
  );
}
