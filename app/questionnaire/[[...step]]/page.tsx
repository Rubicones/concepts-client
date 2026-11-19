import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isTestMode } from "@/lib/env";
import { getViewer } from "@/lib/viewer";
import { loadQuestionnaire } from "@/lib/questionnaire";
import { loadLegalDocs } from "@/lib/legal";
import { Questionnaire } from "@/components/questionnaire/Questionnaire";

export const metadata: Metadata = { title: "Brand questionnaire" };

/** /questionnaire/<step>: the step is read on the client; the server loads the questionnaire once. */
export default function QuestionnairePage() {
  return (
    <Suspense fallback={<QuestionnaireSkeleton />}>
      <Load />
    </Suspense>
  );
}

async function Load() {
  const viewer = await getViewer();
  if (!viewer) {
    if (isTestMode()) redirect("/");
    notFound();
  }
  if (viewer.kind === "forma-brand") redirect(`/gallery/${viewer.formaBrandId}`);
  const view = await loadQuestionnaire(viewer);
  const legal = await loadLegalDocs(view.state.role === "agency");
  // Remount when the studio changes the status, so the page reflects it cleanly.
  return <Questionnaire key={`${view.id}:${view.status}`} initial={view} legal={legal} testMode={isTestMode()} />;
}

function QuestionnaireSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[var(--page-max)] gap-5 px-3 pb-24 pt-5 sm:px-[var(--gutter)] lg:grid-cols-[300px_1fr]" aria-busy="true" aria-label="Loading the questionnaire">
      <div className="hidden h-[520px] rounded-card bg-gray p-5 lg:block">
        <span className="skeleton block h-1.5 w-full rounded-full" />
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="skeleton mt-4 block h-6 w-3/4 rounded-input" />
        ))}
      </div>
      <div>
        <span className="skeleton block h-[220px] rounded-card" />
        <span className="skeleton mt-5 block h-[420px] rounded-card" />
      </div>
    </div>
  );
}
