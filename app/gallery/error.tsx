"use client";

import { useEffect } from "react";
import { PageContainer } from "@/components/shell/PageHeader";
import { Banner } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";

/** The gallery reads Forma's store; if that fails, say so and offer a retry (re-fetches the segment). */
export default function GalleryError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[gallery]", error);
  }, [error]);
  return (
    <PageContainer className="pt-14">
      <Banner tone="err" title="We couldn't load this from Forma" action={<Button onClick={() => retry()}>Try again</Button>}>
        The store didn&apos;t answer. Check the Supabase and R2 settings, then try again.
      </Banner>
    </PageContainer>
  );
}
