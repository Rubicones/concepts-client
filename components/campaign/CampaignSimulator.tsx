"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { campaignLabel } from "@/lib/client-status";
import type { CampaignStatus } from "@/lib/db-types";
import { simAccept, simCancel } from "@/app/actions/campaigns";
import { StatusPill } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SimulatorShell } from "@/components/test-mode/SimulatorShell";
import { SendDirections } from "./SendDirections";
import { SendFinal } from "./SendFinal";
import { simSeedExports } from "@/app/actions/final";

const INTERNAL: Record<CampaignStatus, string> = {
  submitted: "submitted",
  in_progress: "in_progress",
  review_directions: "review_directions",
  in_production: "in_production",
  delivered: "delivered",
  cancelled: "cancelled",
};

/** Studio transitions for a campaign: accept, send directions and the final from Forma campaigns, seed sample exports, cancel. */
export function CampaignSimulator({ id, status, version }: { id: string; status: CampaignStatus; version: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast({ title: r.error ?? "That didn't work.", tone: "err" });
      else {
        toast({ title: done, tone: "ok" });
        setConfirmCancel(false);
        router.refresh();
      }
    });

  return (
    <SimulatorShell badge={<StatusPill {...campaignLabel[status]} className="h-6 px-2.5 text-caption" />}>
      <p className="text-caption text-white/70">
        Campaign · {INTERNAL[status]} · v{version}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="inverse" disabled={status !== "submitted" || pending} state={pending ? "loading" : "idle"} onClick={() => run(() => simAccept(id, version), "Accepted")}>
          Accept
        </Button>
        {status !== "delivered" && status !== "cancelled" && (
          <Button
            size="sm"
            variant="ghost"
            className="!text-white hover:!bg-white/10"
            disabled={pending}
            onClick={() => (confirmCancel ? run(() => simCancel(id, version), "Cancelled") : setConfirmCancel(true))}
          >
            {confirmCancel ? "Tap again to cancel it" : "Cancel campaign"}
          </Button>
        )}
      </div>
      {status === "in_progress" && <SendDirections key={version} campaignId={id} version={version} />}
      {status === "in_production" && <SendFinal key={version} campaignId={id} version={version} />}
      {status === "delivered" && (
        <div className="flex flex-col gap-2 rounded-tile-sm bg-white/5 p-3">
          <p className="text-caption font-semibold uppercase tracking-[0.06em] text-white/70">Exports</p>
          <p className="text-caption text-white/60">Fills the download panel with the sample files in fixtures/exports/, for every format, language and length of the final.</p>
          <Button
            size="sm"
            variant="inverse"
            disabled={pending}
            state={pending ? "loading" : "idle"}
            onClick={() =>
              start(async () => {
                const r = await simSeedExports(id);
                if (!r.ok) toast({ title: r.error, tone: "err" });
                else {
                  toast({ title: `${r.data.count} sample exports ready`, tone: "ok" });
                  router.refresh();
                }
              })
            }
          >
            Seed sample exports
          </Button>
        </div>
      )}
    </SimulatorShell>
  );
}
