import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isTestMode } from "@/lib/env";
import { getFormaBrand, listBrandCampaigns } from "@/lib/forma";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { CampaignCard, CampaignCardSkeleton } from "@/components/gallery/CampaignCard";
import { EmptyState } from "@/components/ui/Feedback";
import { InboxIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Results gallery" };

/** Test mode: every campaign of a Forma brand that no client account links to (spec §6.1). */
export default function BrandGalleryPage({ params }: PageProps<"/gallery/[brandId]">) {
  if (!isTestMode()) notFound();
  return (
    <PageContainer>
      <Suspense fallback={<BrandGallerySkeleton />}>
        <BrandGallery params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function BrandGallery({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const [brand, campaigns] = await Promise.all([getFormaBrand(brandId), listBrandCampaigns(brandId)]);
  if (!brand) notFound();
  const ready = campaigns.filter((c) => c.hasFinal).length;

  return (
    <>
      <PageHeader
        kicker="Test mode · Forma brand"
        title={brand.name}
        lead={
          campaigns.length
            ? `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}${ready ? `, ${ready} with a final` : ""}. Shown as the client would see them.`
            : undefined
        }
      />
      {campaigns.length ? (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <CampaignCard campaign={c} href={`/gallery/${brandId}/${c.id}`} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<InboxIcon size={20} />} title="No campaigns for this brand yet">
          When the studio starts a campaign for {brand.name} in Forma, it shows up here.
        </EmptyState>
      )}
    </>
  );
}

function BrandGallerySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading campaigns">
      <div className="flex flex-col gap-3 pb-8 pt-10 sm:pt-14">
        <span className="skeleton block h-[14px] w-40 rounded-tag" />
        <span className="skeleton block h-8 w-72 rounded-input sm:h-11" />
        <span className="skeleton block h-[26px] w-96 max-w-full rounded-input" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <CampaignCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
