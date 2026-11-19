import "server-only";
import { db } from "./supabase";
import { isTestMode } from "./env";
import type { Viewer } from "./viewer";
import { DIRECTIONS_PER_DELIVERY, MAX_REBUILDS } from "./limits";
import type { BrandQuestionnaire, CampaignRequest, CampaignStatus, QuestionnaireStatus } from "./db-types";

/**
 * Every status change goes through this module (spec §4, §4.1, §9).
 *
 * Two layers:
 *  - `plan*` functions are pure: given the current status, the actor and the
 *    action, they return the next status, the event to record and the side
 *    effects, or a TransitionError. Unit-tested exhaustively.
 *  - `apply*` functions load the row (scoped to the viewer), plan, then call one
 *    Postgres function that does compare-and-set on `version`, re-checks the
 *    from-status, writes the side effects and the `client_events` row in a
 *    single transaction. A stale version or a raced status returns 409.
 */

export type Actor = "client" | "studio";

export { DIRECTIONS_PER_DELIVERY, MAX_REBUILDS };
export const CONFLICT_MESSAGE = "Someone just updated this. Refresh to see the latest.";

export type TransitionErrorCode = "forbidden" | "invalid" | "conflict" | "not_found";

export class TransitionError extends Error {
  constructor(
    public readonly code: TransitionErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TransitionError";
  }
  get status(): number {
    return { forbidden: 403, invalid: 422, conflict: 409, not_found: 404 }[this.code];
  }
}

export interface EventSpec {
  type: string;
  payload: Record<string, unknown>;
}

/* ------------------------------------------------------------------------ */
/* Brand questionnaire                                                       */
/* ------------------------------------------------------------------------ */

export type QuestionnaireAction =
  /** Client sends (from draft) or resends answers (from changes_requested). */
  | { type: "submit"; missing: string[]; signatures: { nda: boolean; terms: boolean } }
  /** Studio asks follow-ups: ≥ 1 note and the question ids that unlock. */
  | { type: "request_changes"; noteCount: number; unlocked: string[] }
  /** Studio approves; one client brand per brand account or per agency client. */
  | { type: "approve"; brands: { name: string; questionnaire_scope: string | null }[] };

export interface QuestionnairePlan {
  from: QuestionnaireStatus;
  to: QuestionnaireStatus;
  unlocked: string[];
  brands: { name: string; questionnaire_scope: string | null }[] | null;
  event: EventSpec;
}

const Q_RULES: Record<QuestionnaireAction["type"], { actor: Actor; from: QuestionnaireStatus[]; to: QuestionnaireStatus }> = {
  submit: { actor: "client", from: ["draft", "changes_requested"], to: "submitted" },
  request_changes: { actor: "studio", from: ["submitted"], to: "changes_requested" },
  approve: { actor: "studio", from: ["submitted"], to: "approved" },
};

export function planQuestionnaireTransition(
  current: QuestionnaireStatus,
  actor: Actor,
  action: QuestionnaireAction,
): QuestionnairePlan {
  const rule = Q_RULES[action.type];
  if (rule.actor !== actor) throw new TransitionError("forbidden", "You can't do that here.");
  if (!rule.from.includes(current)) {
    throw new TransitionError("conflict", CONFLICT_MESSAGE, { current, action: action.type });
  }

  switch (action.type) {
    case "submit": {
      const unsigned = (["nda", "terms"] as const).filter((d) => !action.signatures[d]);
      if (action.missing.length || unsigned.length) {
        const parts: string[] = [];
        if (action.missing.length) parts.push(`${action.missing.length} answer${action.missing.length === 1 ? "" : "s"} to finish`);
        if (unsigned.length) parts.push(unsigned.map((d) => (d === "nda" ? "the NDA" : "the terms")).join(" and ") + " to sign");
        throw new TransitionError("invalid", `Almost there: ${parts.join(", and ")}.`, {
          missing: action.missing,
          unsigned,
        });
      }
      return {
        from: current,
        to: rule.to,
        unlocked: [],
        brands: null,
        event: { type: current === "draft" ? "questionnaire.submitted" : "questionnaire.resubmitted", payload: {} },
      };
    }
    case "request_changes": {
      const unlocked = [...new Set(action.unlocked.filter(Boolean))];
      if (action.noteCount < 1 || unlocked.length < 1) {
        throw new TransitionError("invalid", "Write at least one question and pick the answers it concerns.");
      }
      return {
        from: current,
        to: rule.to,
        unlocked,
        brands: null,
        event: { type: "questionnaire.changes_requested", payload: { questions: unlocked.length } },
      };
    }
    case "approve": {
      const brands = action.brands
        .map((b) => ({ name: b.name.trim(), questionnaire_scope: b.questionnaire_scope || null }))
        .filter((b) => b.name);
      if (!brands.length) throw new TransitionError("invalid", "An approved questionnaire needs at least one brand name.");
      const scopes = brands.map((b) => b.questionnaire_scope ?? "");
      if (new Set(scopes).size !== scopes.length) throw new TransitionError("invalid", "Each brand needs its own profile.");
      return {
        from: current,
        to: rule.to,
        unlocked: [],
        brands,
        event: { type: "questionnaire.approved", payload: { brands: brands.length } },
      };
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Campaign request                                                          */
/* ------------------------------------------------------------------------ */

export interface DirectionsSnapshot {
  directions: { id: string; title: string }[];
}

export type CampaignAction =
  | { type: "accept"; formaCampaignId?: string | null }
  | { type: "send_directions"; items: DirectionsSnapshot; sentBy?: string | null }
  | { type: "approve"; deliveryId: string; deliveryItems: DirectionsSnapshot; itemId: string }
  | { type: "rebuild"; deliveryId: string; reason: string; rebuildsUsed: number }
  | { type: "send_final"; items: { final: { id: string } }; sentBy?: string | null }
  | { type: "cancel" };

export interface CampaignPlan {
  from: CampaignStatus;
  to: CampaignStatus;
  patch: { rebuildsInc: boolean; approvedItemId: string | null; formaCampaignId: string | null };
  newDelivery: { stage: "directions" | "final"; items: unknown; sentBy: string | null } | null;
  respond: { deliveryId: string; response: Record<string, unknown> } | null;
  event: EventSpec;
}

const NOT_DELIVERED: CampaignStatus[] = ["submitted", "in_progress", "review_directions", "in_production"];

const C_RULES: Record<CampaignAction["type"], { actor: Actor; from: CampaignStatus[]; to: CampaignStatus }> = {
  accept: { actor: "studio", from: ["submitted"], to: "in_progress" },
  send_directions: { actor: "studio", from: ["in_progress"], to: "review_directions" },
  approve: { actor: "client", from: ["review_directions"], to: "in_production" },
  rebuild: { actor: "client", from: ["review_directions"], to: "in_progress" },
  send_final: { actor: "studio", from: ["in_production"], to: "delivered" },
  cancel: { actor: "studio", from: NOT_DELIVERED, to: "cancelled" },
};

const noPatch = { rebuildsInc: false, approvedItemId: null, formaCampaignId: null };

export function planCampaignTransition(current: CampaignStatus, actor: Actor, action: CampaignAction): CampaignPlan {
  const rule = C_RULES[action.type];
  if (rule.actor !== actor) throw new TransitionError("forbidden", "You can't do that here.");
  if (!rule.from.includes(current)) {
    throw new TransitionError("conflict", CONFLICT_MESSAGE, { current, action: action.type });
  }
  const base = { from: current, to: rule.to, patch: noPatch, newDelivery: null, respond: null } as const;
  const at = new Date().toISOString();

  switch (action.type) {
    case "accept":
      return {
        ...base,
        patch: { ...noPatch, formaCampaignId: action.formaCampaignId ?? null },
        event: { type: "campaign.accepted", payload: {} },
      };
    case "send_directions": {
      const ids = action.items.directions.map((d) => d.id);
      if (ids.length !== DIRECTIONS_PER_DELIVERY || new Set(ids).size !== ids.length || ids.some((id) => !id)) {
        throw new TransitionError("invalid", `Send exactly ${DIRECTIONS_PER_DELIVERY} different directions.`);
      }
      return {
        ...base,
        newDelivery: { stage: "directions", items: action.items, sentBy: action.sentBy ?? null },
        event: { type: "directions.sent", payload: {} },
      };
    }
    case "approve": {
      if (!action.deliveryItems.directions.some((d) => d.id === action.itemId)) {
        throw new TransitionError("invalid", "That direction isn't part of this review.");
      }
      return {
        ...base,
        patch: { ...noPatch, approvedItemId: action.itemId },
        respond: { deliveryId: action.deliveryId, response: { decision: "approve", itemId: action.itemId, at } },
        event: { type: "direction.approved", payload: { itemId: action.itemId } },
      };
    }
    case "rebuild": {
      if (action.rebuildsUsed >= MAX_REBUILDS) {
        throw new TransitionError("invalid", "You've used both rebuilds. Choose a direction, or write to us.");
      }
      const reason = action.reason.trim();
      if (!reason) throw new TransitionError("invalid", "Tell us in a few words what didn't work.");
      if (reason.length > 4000) throw new TransitionError("invalid", "Please keep the reason under 4,000 characters.");
      return {
        ...base,
        patch: { ...noPatch, rebuildsInc: true },
        respond: { deliveryId: action.deliveryId, response: { decision: "rebuild", reason, at } },
        event: { type: "directions.rebuild_requested", payload: { round: action.rebuildsUsed + 1 } },
      };
    }
    case "send_final":
      if (!action.items.final?.id) throw new TransitionError("invalid", "Pick the final to send.");
      return {
        ...base,
        newDelivery: { stage: "final", items: action.items, sentBy: action.sentBy ?? null },
        event: { type: "final.delivered", payload: {} },
      };
    case "cancel":
      return { ...base, event: { type: "campaign.cancelled", payload: {} } };
  }
}

/* ------------------------------------------------------------------------ */
/* Persistence                                                               */
/* ------------------------------------------------------------------------ */

export type Caller = { actor: "client"; viewer: Extract<Viewer, { kind: "account" }> } | { actor: "studio"; author?: string };

function assertCaller(caller: Caller) {
  // Until Forma moderation exists, studio actions come only from the test-mode simulator.
  if (caller.actor === "studio" && !isTestMode()) throw new TransitionError("forbidden", "You can't do that here.");
}

function ownedBy(caller: Caller, accountId: string) {
  if (caller.actor === "client" && caller.viewer.accountId !== accountId) {
    // Same answer as a missing row: never reveal another account's ids.
    throw new TransitionError("not_found", "We couldn't find that.");
  }
}

export async function applyQuestionnaireTransition(
  caller: Caller,
  questionnaireId: string,
  expectedVersion: number,
  action: QuestionnaireAction,
): Promise<BrandQuestionnaire> {
  assertCaller(caller);
  const { data: row, error } = await db()
    .from("brand_questionnaires")
    .select("id, account_id, status, version")
    .eq("id", questionnaireId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new TransitionError("not_found", "We couldn't find that.");
  ownedBy(caller, row.account_id);
  if (row.version !== expectedVersion) throw new TransitionError("conflict", CONFLICT_MESSAGE);

  const plan = planQuestionnaireTransition(row.status, caller.actor, action);
  const { data, error: rpcError } = await db().rpc("client_questionnaire_transition", {
    p_id: questionnaireId,
    p_expected_version: expectedVersion,
    p_from: plan.from,
    p_to: plan.to,
    p_unlocked: plan.unlocked,
    p_brands: plan.brands,
    p_event_type: plan.event.type,
    p_event_payload: plan.event.payload,
  });
  if (rpcError) throw rpcError;
  const next = (data as BrandQuestionnaire[] | null)?.[0];
  if (!next) throw new TransitionError("conflict", CONFLICT_MESSAGE);
  return next;
}

export async function applyCampaignTransition(
  caller: Caller,
  campaignId: string,
  expectedVersion: number,
  action: CampaignAction,
): Promise<CampaignRequest> {
  assertCaller(caller);
  const { data: row, error } = await db()
    .from("campaign_requests")
    .select("id, account_id, status, version, rebuilds_used")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new TransitionError("not_found", "We couldn't find that.");
  ownedBy(caller, row.account_id);
  if (row.version !== expectedVersion) throw new TransitionError("conflict", CONFLICT_MESSAGE);

  // The server's count wins over whatever the browser sent.
  const checked = action.type === "rebuild" ? { ...action, rebuildsUsed: row.rebuilds_used } : action;
  const plan = planCampaignTransition(row.status, caller.actor, checked);

  const { data, error: rpcError } = await db().rpc("client_campaign_transition", {
    p_id: campaignId,
    p_expected_version: expectedVersion,
    p_from: plan.from,
    p_to: plan.to,
    p_rebuilds_inc: plan.patch.rebuildsInc,
    p_approved_item_id: plan.patch.approvedItemId,
    p_forma_campaign_id: plan.patch.formaCampaignId,
    p_new_delivery: plan.newDelivery,
    p_respond_delivery: plan.respond?.deliveryId ?? null,
    p_response: plan.respond?.response ?? null,
    p_event_type: plan.event.type,
    p_event_payload: plan.event.payload,
  });
  if (rpcError) {
    // Raised by the function when the delivery was already answered or replaced.
    if (rpcError.message?.includes("delivery_not_open")) throw new TransitionError("conflict", CONFLICT_MESSAGE);
    throw rpcError;
  }
  const next = (data as CampaignRequest[] | null)?.[0];
  if (!next) throw new TransitionError("conflict", CONFLICT_MESSAGE);
  return next;
}
