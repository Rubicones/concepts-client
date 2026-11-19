import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isTestMode } from "@/lib/env";
import { getFormaBrand, getGalleryCampaign } from "@/lib/forma";
import { KIND_LABEL } from "@/lib/forma-map";
import { formatLabels, languageCodes, lengthLabels } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { DirectionsGallery } from "@/components/gallery/DirectionsGallery";
import { FinalViewer } from "@/components/player/FinalViewer";
import { DownloadPanel } from "@/components/final/DownloadPanel";
import { EmptyState } from "@/components/ui/Feedback";
import { ArrowLeftIcon, SparkIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Campaign" };

/** One Forma campaign shown as the client would see its deliveries: directions, then the final. */
export default function GalleryCampaignPage({ params }: PageProps<"/gallery/[brandId]/[campaignId]">) {
  if (!isTestMode()) notFound();
  return (
    <PageContainer>
      <Suspense fallback={<CampaignSkeleton />}>
        <Campaign params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function Campaign({ params }: { params: Promise<{ brandId: string; campaignId: string }> }) {
  const { brandId, campaignId } = await params;
  const [brand, campaign] = await Promise.all([getFormaBrand(brandId), getGalleryCampaign(brandId, campaignId)]);
  if (!brand || !campaign) notFound();

  const facts = [
    KIND_LABEL[campaign.kind],
    campaign.formats.length ? formatLabels(campaign.formats) : null,
    campaign.langs.length ? languageCodes(campaign.langs) : null,
    campaign.kind !== "poster" && campaign.lengths.length ? lengthLabels(campaign.lengths) : null,
  ].filter(Boolean);

  return (
    <>
      <Link
        href={`/gallery/${brandId}`}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-small text-muted transition-colors hover:text-navy"
      >
        <ArrowLeftIcon size={14} />
        {brand.name}
      </Link>
      <PageHeader className="pt-4 sm:pt-6" kicker="Test mode · Results gallery" title={campaign.name} lead={facts.join("  ·  ")} />

      <section aria-labelledby="directions-h" className="flex flex-col gap-5 pb-14">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="directions-h" className="text-title-sm font-semibold">
            Directions <span className="tabular-nums text-muted">{campaign.directions.length || ""}</span>
          </h2>
          {campaign.directions.length > 0 && <p className="hidden text-small text-muted sm:block">Click one to look closer.</p>}
        </div>
        {campaign.directions.length ? (
          <DirectionsGallery directions={campaign.directions} campaignName={campaign.name} />
        ) : (
          <EmptyState icon={<SparkIcon size={20} />} title="No directions built yet">
            When the studio builds previews for this campaign, they appear here as directions.
          </EmptyState>
        )}
      </section>

      <section aria-labelledby="final-h" className="flex flex-col gap-5 border-t border-line pt-10">
        <div className="flex flex-col gap-1">
          <h2 id="final-h" className="text-title-sm font-semibold">
            Final{campaign.final ? ` · ${campaign.final.title}` : ""}
          </h2>
          {campaign.final && <p className="text-small text-muted">Every format, playing in sync. Click a format to see it large.</p>}
        </div>
        {campaign.final ? (
          <FinalViewer
            final={campaign.final}
            actions={<DownloadPanel final={campaign.final} exports={[]} brandName={brand.name} campaignName={campaign.name} />}
          />
        ) : (
          <EmptyState title="No final yet">The final appears here once the studio builds it from the chosen direction.</EmptyState>
        )}
      </section>
    </>
  );
}

function CampaignSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading campaign">
      <span className="skeleton mt-6 block h-7 w-28 rounded-full" />
      <div className="flex flex-col gap-3 pb-8 pt-4 sm:pt-6">
        <span className="skeleton block h-[14px] w-44 rounded-tag" />
        <span className="skeleton block h-8 w-80 max-w-full rounded-input sm:h-11" />
        <span className="skeleton block h-[26px] w-[28rem] max-w-full rounded-input" />
      </div>
      <span className="skeleton mb-5 block h-[26px] w-32 rounded-input" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-card bg-gray p-3 pb-5">
            <span className="skeleton block h-[clamp(300px,50vh,540px)] rounded-tile !bg-white/60" />
            <span className="skeleton mx-2 block h-[26px] w-1/2 rounded-input" />
            <span className="skeleton mx-2 block h-[22px] w-3/4 rounded-input" />
          </div>
        ))}
      </div>
    </div>
  );
}
