import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isTestMode } from "@/lib/env";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { Showcase } from "./Showcase";

export const metadata: Metadata = { title: "Styleguide" };

/** Every primitive in every state, for the owner's review (test mode only, spec §2.3). */
export default function StyleguidePage() {
  if (!isTestMode()) notFound();
  return (
    <PageContainer>
      <PageHeader
        kicker="Test mode · Design system"
        title="Styleguide"
        lead="Tokens and primitives in every state. Hover, press and focus are also painted statically so you can review them side by side."
      />
      <Showcase />
    </PageContainer>
  );
}
