import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isTestMode } from "@/lib/env";
import { getViewer } from "@/lib/viewer";
import { getCampaign } from "@/lib/campaigns";
import { campaignLabel } from "@/lib/client-status";
import { KIND_OPTIONS } from "@/lib/brief";
import type { CampaignDetail } from "@/campaign/types";
import { PageContainer } from "@/components/shell/PageHeader";
import { Banner, StatusPill } from "@/components/ui/Feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { ProgressRail } from "@/components/campaign/ProgressRail";
import { WaitingState } from "@/components/campaign/Waiting";
import { BriefSummary } from "@/components/campaign/BriefSummary";
import { History } from "@/components/campaign/History";
import { CampaignSimulator } from "@/components/campaign/CampaignSimulator";
import { DirectionsReview, EarlierRounds } from "@/components/review/DirectionsReview";
import { FinalViewer } from "@/components/player/FinalViewer";
import { DownloadPanel } from "@/components/final/DownloadPanel";
import { svgDataUri } from "@/components/player/svg";

export const metadata: Metadata = { title: "Campaign" };

/** One campaign: where it stands, and what the client can see or do now (spec §6.4). */
export default function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  return (
    <PageContainer>
      <Suspense fallback={<CampaignSkeleton />}>
        <Load params={params} searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Load({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getViewer();
  if (!viewer) {
    if (isTestMode()) redirect("/");
    notFound();
  }
  if (viewer.kind !== "account") redirect("/");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const campaign = await getCampaign(viewer, id);
  if (!campaign) notFound();
  return <CampaignView c={campaign} justSent={sp.sent === "1"} testMode={isTestMode()} />;
}

function CampaignView({ c, justSent, testMode }: { c: CampaignDetail; justSent: boolean; testMode: boolean }) {
  const kind = KIND_OPTIONS.find((k) => k.value === c.setup.kind)?.title ?? "";
  const directions = [...c.deliveries].filter((d) => d.stage === "directions").sort((a, b) => b.round - a.round);
  const openRound = directions.find((d) => d.status === "sent") ?? null;
  const pastRounds = directions.filter((d) => d.status !== "sent");
  const chosen = c.approvedItemId ? directions.flatMap((d) => d.directions).find((d) => d.id === c.approvedItemId) ?? null : null;
  const final = [...c.deliveries].filter((d) => d.stage === "final").sort((a, b) => b.round - a.round)[0]?.final ?? null;

  return (
    <>
      <Link href="/" className="mt-6 inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-small text-muted transition-colors hover:text-navy">
        <ArrowLeftIcon size={14} /> All campaigns
      </Link>

      <header className="flex flex-col gap-6 pb-8 pt-4 sm:pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <p className="kicker">{[c.brandName, kind].filter(Boolean).join(" · ")}</p>
            <h1 className="text-title font-semibold sm:text-display">{c.name}</h1>
          </div>
          <StatusPill {...campaignLabel[c.status]} className="self-start sm:self-auto" />
        </div>
        {c.status !== "cancelled" && <ProgressRail status={c.status} className="max-w-2xl" />}
      </header>

      {justSent && c.status === "submitted" && (
        <Banner tone="ok" title="Request sent. We'll take it from here." className="mb-6">
          We&apos;ll send you three directions to choose from. You&apos;ll get an email when they&apos;re ready.
        </Banner>
      )}

      {c.status === "review_directions" && openRound && (
        <section aria-labelledby="dir-h" className="mb-12 flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="dir-h" className="text-title-sm font-semibold">
              {openRound.round > 1 ? `Round ${openRound.round} · ` : ""}Three directions to choose from
            </h2>
          </div>
          <DirectionsReview
            key={`${openRound.id}:${c.version}`}
            campaignId={c.id}
            campaignName={c.name}
            version={c.version}
            delivery={openRound}
            comments={c.comments.filter((x) => x.deliveryId === openRound.id)}
            rebuildsUsed={c.rebuildsUsed}
          />
        </section>
      )}

      {c.status === "delivered" && final && (
        <section aria-labelledby="final-h" className="mb-12 flex flex-col gap-4">
          <h2 id="final-h" className="text-title-sm font-semibold">
            Your final · {final.title}
          </h2>
          <FinalViewer
            final={{ ...final, keyframeSvg: chosen?.keyframeSvg ?? null }}
            actions={
              <DownloadPanel
                key={c.exports.map((x) => `${x.format}${x.lang}${x.length}${x.fileType}${x.status}`).join(",")}
                campaignId={c.id}
                final={final}
                exports={c.exports}
                brandName={c.brandName}
                campaignName={c.name}
              />
            }
          />
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          {c.status === "cancelled" && (
            <Banner tone="info" title="This campaign was cancelled">
              Nothing more will happen here. Write to us if that&apos;s a surprise.
            </Banner>
          )}

          {(c.status === "submitted" || c.status === "in_progress") && (
            <WaitingState title={c.status === "submitted" ? "Your brief reached us." : c.rebuildsUsed ? "We're making new directions." : "We're on it."}>
              {c.status === "in_progress" && c.rebuildsUsed
                ? "Thanks for the notes. You'll get an email when the new round is ready to review."
                : "You'll get an email when there's something to review."}
            </WaitingState>
          )}


          {c.status === "in_production" && (
            <>
              {chosen && (
                <div className="flex flex-col overflow-hidden rounded-card bg-gray sm:flex-row">
                  <div className="relative aspect-[4/3] bg-white sm:aspect-auto sm:w-[44%]">
                    {svgDataUri(chosen.keyframeSvg) && (
                      // eslint-disable-next-line @next/next/no-img-element -- keyframe SVG as an inert image
                      <img src={svgDataUri(chosen.keyframeSvg)!} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-6 sm:p-8">
                    <p className="kicker">Your choice</p>
                    <h2 className="text-title font-semibold">You chose {chosen.title}</h2>
                    {chosen.idea && <p className="text-lead text-muted">{chosen.idea}</p>}
                  </div>
                </div>
              )}
              <WaitingState title="We're building the final.">Every format and language, from the direction you chose. You&apos;ll get an email when it&apos;s ready.</WaitingState>
            </>
          )}


          {pastRounds.length > 0 && <EarlierRounds rounds={pastRounds} comments={c.comments} campaignName={c.name} approvedItemId={c.approvedItemId} />}

          <section aria-labelledby="brief-h" className="rounded-card bg-gray p-6 sm:p-8">
            <h2 id="brief-h" className="mb-5 text-title-sm font-semibold">
              The brief
            </h2>
            <BriefSummary setup={c.setup} brief={c.brief} refs={c.refs} />
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card bg-white p-6 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <h2 className="kicker mb-4">History</h2>
            <History events={c.events} />
          </div>
        </aside>
      </div>

      {testMode && <CampaignSimulator id={c.id} status={c.status} version={c.version} />}
    </>
  );
}

function CampaignSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the campaign">
      <span className="skeleton mt-6 block h-7 w-32 rounded-full" />
      <div className="flex flex-col gap-3 pb-8 pt-4 sm:pt-6">
        <span className="skeleton block h-[14px] w-44 rounded-tag" />
        <span className="skeleton block h-8 w-80 max-w-full rounded-input sm:h-11" />
        <span className="skeleton mt-3 block h-6 w-full max-w-2xl rounded-full" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <span className="skeleton block h-72 rounded-card" />
        <span className="skeleton block h-56 rounded-card" />
      </div>
    </div>
  );
}
