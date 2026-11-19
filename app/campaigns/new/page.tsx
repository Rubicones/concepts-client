import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isTestMode } from "@/lib/env";
import { getViewer } from "@/lib/viewer";
import { db } from "@/lib/supabase";
import { activeBrand, questionnaireApproved } from "@/lib/campaigns";
import { normalizeState } from "@/questionnaire/patch";
import { prefillBrief } from "@/questionnaire/prefill";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { BriefForm } from "@/components/brief/BriefForm";
import { EmptyState } from "@/components/ui/Feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "New campaign" };

export default function NewCampaignPage({ searchParams }: PageProps<"/campaigns/new">) {
  return (
    <PageContainer>
      <Suspense fallback={<BriefSkeleton />}>
        <Load searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Load({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getViewer();
  if (!viewer) {
    if (isTestMode()) redirect("/");
    notFound();
  }
  if (viewer.kind !== "account") redirect("/");
  if (!(await questionnaireApproved(viewer))) redirect("/questionnaire");

  const sp = await searchParams;
  const { brands, active } = await activeBrand(viewer);
  const requested = typeof sp.brand === "string" ? brands.find((b) => b.id === sp.brand) : undefined;
  const brand = requested ?? active;
  if (!brand) {
    return (
      <EmptyState title="No brand to start a campaign for yet">
        Once we&apos;ve set up your brand from the questionnaire, you can start campaigns here.
      </EmptyState>
    );
  }

  const { data: q, error } = await db().from("brand_questionnaires").select("id, state").eq("account_id", viewer.accountId).single();
  if (error) throw error;
  const prefill = prefillBrief(normalizeState(q.state), brand.scope);
  const defaultName = prefill.brief.promote.split(/[.:\n]/)[0].trim().slice(0, 60);

  return (
    <>
      <Link href="/" className="mt-6 inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-small text-muted transition-colors hover:text-navy">
        <ArrowLeftIcon size={14} /> All campaigns
      </Link>
      <PageHeader
        className="pt-4 sm:pt-6"
        kicker={`New campaign · ${brand.name}`}
        title="What should we make?"
        lead="About two minutes. Most of it is already filled in from your questionnaire; change anything you like."
      />
      <BriefForm brands={brands} initialBrandId={brand.id} questionnaireId={q.id} prefill={prefill} defaultName={defaultName} />
    </>
  );
}

function BriefSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the brief">
      <span className="skeleton mt-6 block h-7 w-32 rounded-full" />
      <div className="flex flex-col gap-3 pb-8 pt-4 sm:pt-6">
        <span className="skeleton block h-[14px] w-40 rounded-tag" />
        <span className="skeleton block h-8 w-80 max-w-full rounded-input sm:h-11" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <span className="skeleton block h-7 w-full rounded-full" />
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="skeleton block h-20 w-full rounded-input" />
          ))}
        </div>
        <span className="skeleton hidden h-96 rounded-card lg:block" />
      </div>
    </div>
  );
}
