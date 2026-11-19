import Link from "next/link";
import { cn } from "@/lib/cn";
import { KIND_LABEL, type GalleryCampaignSummary } from "@/lib/forma-map";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { StatusPill } from "@/components/ui/Feedback";
import { FormatGlyph } from "@/components/player/FormatChip";
import { svgDataUri } from "@/components/player/svg";
import { CreativeFrame } from "@/components/player/CreativeFrame";
import { containStyle } from "@/lib/format";

/**
 * A campaign as a rich card: name, kind and formats, where it stands, when it moved.
 * With a final, the tile shows the final itself (frame 0, paused — Forma designs frame 0
 * as the thumbnail), loaded last in the queue; until then, and without one, the keyframe.
 */
export function CampaignCard({ campaign, href }: { campaign: GalleryCampaignSummary; href: string }) {
  const cover = svgDataUri(campaign.cover);
  const status = campaign.archived
    ? { label: "Archived", tone: "muted" as const }
    : campaign.hasFinal
      ? { label: "Final ready", tone: "ok" as const }
      : campaign.directionCount
        ? { label: `${campaign.directionCount} direction${campaign.directionCount === 1 ? "" : "s"}`, tone: "progress" as const }
        : { label: "In progress", tone: "neutral" as const };

  return (
    <Link
      href={href}
      prefetch
      className="group flex flex-col gap-4 rounded-card bg-gray p-3 pb-5 transition-[transform,background-color,box-shadow] duration-200 ease-out hover:bg-gray-strong/70 active:scale-[0.99]"
    >
      <div className={cn("relative grid aspect-[4/3] place-items-center overflow-hidden rounded-tile", cover || campaign.final ? "bg-white" : "hero-gradient")}>
        {campaign.final ? (
          <div className="grid size-full place-items-center [container-type:size]">
            <CreativeFrame
              path={campaign.final.path}
              format={campaign.final.format}
              lang={campaign.final.lang}
              length={campaign.final.length}
              startAt={0}
              startPaused
              poster={campaign.cover}
              priority={2}
              title={`${campaign.name}, final`}
              className="bg-white"
              style={containStyle(campaign.final.format)}
            />
          </div>
        ) : cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- keyframe SVG as an inert image
          <img
            src={cover}
            alt=""
            aria-hidden="true"
            className="size-full object-cover transition-transform duration-[420ms] ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <span className="text-title-sm font-semibold text-white/90">{campaign.name.slice(0, 1)}</span>
        )}
      </div>
      <div className="flex flex-col gap-2 px-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-title-sm font-semibold">{campaign.name}</h3>
          <StatusPill {...status} className="mt-0.5 shrink-0" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted">
          <span>{KIND_LABEL[campaign.kind]}</span>
          {campaign.formats.length > 0 && (
            <span className="flex items-center gap-1" aria-label={`Formats: ${campaign.formats.join(", ")}`}>
              {campaign.formats.map((f) => (
                <FormatGlyph key={f} format={f} size={14} />
              ))}
            </span>
          )}
          {campaign.langs.length > 0 && <span className="tabular-nums">{campaign.langs.map((l) => l.toUpperCase()).join(" ")}</span>}
        </div>
        <p className="text-caption text-muted">Updated <RelativeTime iso={campaign.updatedAt} /></p>
      </div>
    </Link>
  );
}

export function CampaignCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-card bg-gray p-3 pb-5" aria-hidden="true">
      <span className="skeleton block aspect-[4/3] rounded-tile !bg-white/60" />
      <div className="flex flex-col gap-2 px-2">
        <span className="skeleton block h-[26px] w-2/3 rounded-input" />
        <span className="skeleton block h-[18px] w-1/2 rounded-input" />
        <span className="skeleton block h-4 w-1/3 rounded-input" />
      </div>
    </div>
  );
}
