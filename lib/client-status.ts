import type { CampaignStatus, QuestionnaireStatus } from "./db-types";

/**
 * The only status words a client ever sees (spec §1.3, §10). Internal statuses
 * never render; every UI goes through these maps.
 */

export type StatusTone = "neutral" | "progress" | "attention" | "ok" | "muted";

export const questionnaireLabel: Record<QuestionnaireStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "In review", tone: "progress" },
  changes_requested: { label: "Questions for you", tone: "attention" },
  approved: { label: "Approved", tone: "ok" },
};

export const campaignLabel: Record<CampaignStatus, { label: string; tone: StatusTone }> = {
  submitted: { label: "Request sent", tone: "neutral" },
  in_progress: { label: "In progress", tone: "progress" },
  review_directions: { label: "Ready for your review", tone: "attention" },
  in_production: { label: "In progress", tone: "progress" },
  delivered: { label: "Ready", tone: "ok" },
  // Not in the spec's table: a studio-only action. Owner to confirm the wording.
  cancelled: { label: "Cancelled", tone: "muted" },
};

/** Statuses that ask the client to act; they lead the home page. */
export const needsClientAction = {
  questionnaire: (s: QuestionnaireStatus) => s === "draft" || s === "changes_requested",
  campaign: (s: CampaignStatus) => s === "review_directions",
};
