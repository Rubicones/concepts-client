import { KIND_OPTIONS, type BriefAnswers, type CampaignSetup } from "@/lib/brief";
import { formatInfo, language } from "@/lib/forma-constants";
import type { ClientFile } from "@/questionnaire/types";
import { FormatGlyph } from "@/components/player/FormatChip";

/** The brief as sent, read like a document. Used on the campaign page and in "Check & send". */
export function BriefSummary({ setup, brief, refs = [], compact }: { setup: Partial<CampaignSetup>; brief: Partial<BriefAnswers>; refs?: ClientFile[]; compact?: boolean }) {
  const kind = KIND_OPTIONS.find((k) => k.value === setup.kind);
  const rows: [string, React.ReactNode][] = [
    ["Promoting", brief.promote || "—"],
    ["Product", brief.product || "—"],
    ["Goal", brief.goal || "—"],
    ["Offer", brief.offer ? (brief.offerText ? `${brief.offer}: “${brief.offerText}”` : brief.offer) : "—"],
    ["Button text", brief.cta || "—"],
    ["Kind", kind?.title ?? "—"],
    [
      "Formats",
      setup.formats?.length ? (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {setup.formats.map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5 tabular-nums">
              <FormatGlyph format={f} size={14} /> {formatInfo(f).label}
            </span>
          ))}
        </span>
      ) : (
        "—"
      ),
    ],
    ...(setup.kind !== "poster" ? ([["Lengths", setup.lengths?.length ? setup.lengths.map((l) => `${l} s`).join(" · ") : "—"]] as [string, React.ReactNode][]) : []),
    ["Languages", setup.languages?.length ? setup.languages.map((l) => language(l).name).join(", ") : "—"],
  ];
  if (!compact) {
    if (brief.links?.some((l) => l.a)) rows.push(["References", brief.links.filter((l) => l.a).map((l) => l.a).join(", ")]);
    if (refs.length) rows.push(["Files", refs.map((f) => f.name).join(", ")]);
    if (brief.note) rows.push(["Note", brief.note]);
  }
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[140px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="kicker pt-0.5">{k}</dt>
          <dd className="break-words text-body">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
