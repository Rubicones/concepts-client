import type { CampaignStatus } from "@/lib/db-types";

/**
 * The client's view of a campaign: three steps, Brief → Directions → Final
 * (spec §6.4). Internal stages never show; "current" is where things stand now.
 */

export type RailStep = "brief" | "directions" | "final";
export const RAIL: { id: RailStep; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "directions", label: "Directions" },
  { id: "final", label: "Final" },
];

export function railState(status: CampaignStatus): { current: RailStep | null; done: RailStep[]; needsYou: boolean } {
  switch (status) {
    case "submitted":
      return { current: "brief", done: [], needsYou: false };
    case "in_progress":
      return { current: "directions", done: ["brief"], needsYou: false };
    case "review_directions":
      return { current: "directions", done: ["brief"], needsYou: true };
    case "in_production":
      return { current: "final", done: ["brief", "directions"], needsYou: false };
    case "delivered":
      return { current: null, done: ["brief", "directions", "final"], needsYou: false };
    case "cancelled":
      return { current: null, done: [], needsYou: false };
  }
}

/** History lines, in the client's words. */
export function eventLabel(type: string, payload: Record<string, unknown>): string | null {
  const round = typeof payload.round === "number" ? payload.round : null;
  switch (type) {
    case "campaign.submitted":
      return "Request sent";
    case "campaign.accepted":
      return "We started work";
    case "directions.sent":
      return round && round > 1 ? `New directions ready · round ${round}` : "Directions ready for your review";
    case "direction.approved":
      return "You chose a direction";
    case "directions.rebuild_requested":
      return "You asked for new directions";
    case "final.delivered":
      return "Final delivered";
    case "campaign.cancelled":
      return "Campaign cancelled";
    default:
      return null;
  }
}
