import { eventLabel } from "@/campaign/progress";
import type { CampaignEvent } from "@/campaign/types";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** What happened, newest last, in the client's words (from client_events). */
export function History({ events }: { events: CampaignEvent[] }) {
  const lines = events.map((e) => ({ ...e, label: eventLabel(e.type, e.payload) })).filter((e) => e.label);
  if (!lines.length) return <p className="text-small text-muted">Nothing yet.</p>;
  return (
    <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
      {lines.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pl-0">
          <span className={`relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 ${i === lines.length - 1 ? "border-navy bg-navy" : "border-mist bg-white"}`} aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-body font-medium">{e.label}</span>
            <time dateTime={e.at} className="text-caption tabular-nums text-muted">
              {fmt(e.at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
