import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isTestMode } from "@/lib/env";
import { getViewerOrNull } from "@/lib/viewer";
import { activeBrand, listCampaigns, questionnaireApproved } from "@/lib/campaigns";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/Feedback";
import { buttonClass } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Tooltip";
import { ArrowRightIcon, PlusIcon, SearchIcon, SparkIcon } from "@/components/ui/icons";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { BrandPicker } from "@/components/campaign/BrandPicker";
import { svgDataUri } from "@/components/player/svg";

/**
 * Home (spec §6.3). What needs the client comes first, as one card with one
 * button; then the campaigns. The primary action is "New campaign".
 */
export default function Home() {
  return (
    <PageContainer>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </PageContainer>
  );
}

async function HomeContent() {
  const viewer = await getViewerOrNull();
  if (viewer?.kind === "forma-brand") redirect(`/gallery/${viewer.formaBrandId}`);

  if (!viewer) {
    if (!isTestMode()) {
      return <PageHeader kicker="Toggle Concepts" title="Your campaigns" lead="Sign-in arrives soon. Use the link we sent you to open your dashboard." />;
    }
    return (
      <>
        <PageHeader kicker="Test mode" title="Pick a brand to look at" lead="Client accounts open their dashboard. Forma brands open a results gallery." />
        <EmptyState
          tone="sky"
          icon={<SearchIcon size={20} />}
          title="Use the brand switcher in the top bar"
          action={
            <span className="inline-flex items-center gap-1 text-small text-muted">
              or press <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          }
        >
          Every client account and every Forma brand is listed there, with its status. “New brand” starts a fresh questionnaire.
        </EmptyState>
      </>
    );
  }

  // First visit and until approval, the questionnaire is the dashboard (spec §1.2).
  if (!(await questionnaireApproved(viewer))) redirect("/questionnaire");

  const { brands, active } = await activeBrand(viewer);
  const campaigns = await listCampaigns(viewer, active?.id ?? null);
  const waiting = campaigns.filter((c) => c.status === "review_directions");
  const isAgency = viewer.account.kind === "agency";
  const newHref = active ? `/campaigns/new?brand=${active.id}` : "/campaigns/new";

  return (
    <>
      <PageHeader
        kicker={isAgency ? (active ? `Client · ${active.name}` : "Your clients") : (active?.name ?? viewer.account.name ?? "Your brand")}
        title="Your campaigns"
        lead={campaigns.length ? "Everything you've asked for, and where it stands." : "Tell us what to promote. We'll take it from there."}
        actions={
          <>
            {isAgency && active && brands.length > 1 && <BrandPicker brands={brands} active={active} />}
            {campaigns.length > 0 && (
              <Link href={newHref} className={buttonClass({ variant: "primary" })}>
                <PlusIcon size={16} /> New campaign
              </Link>
            )}
          </>
        }
      />

      {waiting.length > 0 && <ActionCard name={waiting[0].name} id={waiting[0].id} thumbnail={waiting[0].thumbnail} more={waiting.length - 1} />}

      {campaigns.length ? (
        <section aria-label="Campaigns">
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((c) => (
              <li key={c.id}>
                <CampaignCard campaign={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <FirstCampaign href={newHref} />
      )}
    </>
  );
}

/** One prominent card, one button: the thing that needs the client now. */
function ActionCard({ id, name, thumbnail, more }: { id: string; name: string; thumbnail: string | null; more: number }) {
  const src = svgDataUri(thumbnail);
  return (
    <Link
      href={`/campaigns/${id}`}
      className="group mb-8 flex flex-col overflow-hidden rounded-card bg-navy text-white transition-transform duration-200 active:scale-[0.995] sm:flex-row"
    >
      <div className="flex flex-1 flex-col gap-3 p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.08em] text-white/80">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-orange opacity-60 motion-reduce:hidden" />
            <span className="relative size-2 rounded-full bg-orange" />
          </span>
          Ready for your review
        </span>
        <h2 className="text-title font-semibold">Three directions for {name}</h2>
        <p className="text-lead text-white/80">
          Look, comment on the picture, and choose one. It takes a few minutes.
          {more > 0 ? ` ${more} more campaign${more === 1 ? "" : "s"} waiting too.` : ""}
        </p>
        <span className={buttonClass({ variant: "attention", className: "mt-2 self-start" })}>
          Review directions <ArrowRightIcon size={16} />
        </span>
      </div>
      {src && (
        <div className="relative hidden w-[38%] bg-white sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element -- keyframe SVG as an inert image */}
          <img src={src} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover transition-transform duration-[420ms] group-hover:scale-[1.03]" />
        </div>
      )}
    </Link>
  );
}

function FirstCampaign({ href }: { href: string }) {
  const steps = [
    ["1", "Brief", "Two minutes: what to promote, and what we'll make. Most of it is already filled in from your questionnaire."],
    ["2", "Directions to review", "We send three directions. You comment right on the picture and choose one."],
    ["3", "Final", "We build every format and language. Watch them all, then download."],
  ];
  return (
    <div className="hero-gradient overflow-hidden rounded-card p-6 text-white sm:p-12">
      <p className="text-caption font-semibold uppercase tracking-[0.08em] text-white/80">Your first campaign</p>
      <h2 className="mt-3 max-w-2xl text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[48px]">Three steps from idea to every format.</h2>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {steps.map(([n, title, body]) => (
          <div key={n} className="rounded-tile bg-white/10 p-5 backdrop-blur-sm">
            <span className="text-caption font-semibold tabular-nums text-white/70">0{n}</span>
            <p className="mt-2 text-title-sm font-semibold">{title}</p>
            <p className="mt-1 text-small text-white/80">{body}</p>
          </div>
        ))}
      </div>
      <Link href={href} className={buttonClass({ variant: "inverse", size: "lg", className: "mt-8 font-bold uppercase tracking-[0.04em] !text-small" })}>
        <SparkIcon size={16} /> Start a campaign
      </Link>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your campaigns">
      <div className="flex flex-col gap-3 pb-8 pt-10 sm:pt-14">
        <span className="skeleton block h-[14px] w-32 rounded-tag" />
        <span className="skeleton block h-8 w-72 rounded-input sm:h-11" />
        <span className="skeleton block h-[26px] w-96 max-w-full rounded-input" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-card bg-gray p-3 pb-5">
            <span className="skeleton block aspect-[4/3] rounded-tile !bg-white/60" />
            <span className="skeleton mx-2 block h-[26px] w-2/3 rounded-input" />
            <span className="skeleton mx-2 block h-[18px] w-1/2 rounded-input" />
          </div>
        ))}
      </div>
    </div>
  );
}
