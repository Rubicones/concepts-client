import Link from "next/link";
import { campaignLabel } from "@/lib/client-status";
import { KIND_OPTIONS } from "@/lib/brief";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type { CampaignSummary } from "@/campaign/types";
import { StatusPill } from "@/components/ui/Feedback";
import { FormatGlyph } from "@/components/player/FormatChip";
import { svgDataUri } from "@/components/player/svg";
import { ProgressDots } from "./ProgressRail";
import { KindGlyph } from "./KindIllustration";

/** A campaign as a rich card: latest frame (or a branded placeholder), name, kind and formats, status, progress, when it moved. */
export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const thumb = svgDataUri(campaign.thumbnail);
  const status = campaignLabel[campaign.status];
  const kind = KIND_OPTIONS.find((k) => k.value === campaign.setup.kind);
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      prefetch
      className="group flex flex-col gap-4 rounded-card bg-gray p-3 pb-5 transition-[transform,background-color] duration-200 ease-out hover:bg-gray-strong/70 active:scale-[0.99]"
    >
      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-tile bg-white">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- keyframe SVG as an inert image
          <img src={thumb} alt="" aria-hidden="true" className="size-full object-cover transition-transform duration-[420ms] ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
        ) : (
          <div className="hero-gradient grid size-full place-items-center text-white/90">
            <KindGlyph kind={campaign.setup.kind} />
          </div>
        )}
        {status.tone === "attention" && <span className="absolute left-3 top-3 size-2.5 rounded-full bg-orange shadow-[0_0_0_4px_rgb(255_79_23/0.2)]" aria-hidden="true" />}
      </div>
      <div className="flex flex-col gap-2 px-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-title-sm font-semibold">{campaign.name}</h3>
          <StatusPill {...status} className="mt-0.5 shrink-0" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted">
          <span>{kind?.title.replace(/ \(.*\)$/, "")}</span>
          <span className="flex items-center gap-1" aria-label={`Formats: ${campaign.setup.formats.join(", ")}`}>
            {campaign.setup.formats.map((f) => (
              <FormatGlyph key={f} format={f} size={14} />
            ))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <ProgressDots status={campaign.status} />
          <span className="text-caption text-muted">Updated <RelativeTime iso={campaign.updatedAt} /></span>
        </div>
      </div>
    </Link>
  );
}
