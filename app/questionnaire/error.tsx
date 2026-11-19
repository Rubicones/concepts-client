"use client";

import { useEffect } from "react";
import { PageContainer } from "@/components/shell/PageHeader";
import { Banner } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";

/** If the questionnaire can't load, say so calmly; answers already saved are safe on the server or this device. */
export default function QuestionnaireError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[questionnaire]", error);
  }, [error]);
  return (
    <PageContainer className="pt-14">
      <Banner tone="err" title="We couldn't open your questionnaire" action={<Button onClick={() => retry()}>Try again</Button>}>
        Nothing you typed is lost: saved answers are on our side, unsaved ones stay on this device. Try again in a moment.
      </Banner>
    </PageContainer>
  );
}
