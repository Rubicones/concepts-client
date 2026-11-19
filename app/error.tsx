"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/Feedback";
import { Button, buttonClass } from "@/components/ui/Button";
import { AlertIcon } from "@/components/ui/icons";

/** Anything a page could not load: say so calmly, keep the way back, offer a retry (spec §2.2, §9). */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[page]", error);
  }, [error]);
  return (
    <PageContainer className="pt-14">
      <EmptyState
        icon={<AlertIcon size={20} />}
        title="This page didn't load"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => retry()}>Try again</Button>
            <Link href="/" className={buttonClass({ variant: "ghost" })}>
              Back to your campaigns
            </Link>
          </div>
        }
      >
        Something on our side didn&apos;t answer. Nothing you entered is lost. Try again in a moment, or write to us if it keeps happening.
      </EmptyState>
    </PageContainer>
  );
}
