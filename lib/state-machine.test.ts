import { describe, expect, it } from "vitest";
import {
  CONFLICT_MESSAGE,
  MAX_REBUILDS,
  planCampaignTransition,
  planQuestionnaireTransition,
  TransitionError,
  type Actor,
  type CampaignAction,
  type QuestionnaireAction,
} from "./state-machine";
import type { CampaignStatus, QuestionnaireStatus } from "./db-types";
import { campaignLabel, questionnaireLabel } from "./client-status";

const ACTORS: Actor[] = ["client", "studio"];

function errorOf(fn: () => unknown): TransitionError | null {
  try {
    fn();
    return null;
  } catch (e) {
    if (e instanceof TransitionError) return e;
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Questionnaire                                                       */
/* ------------------------------------------------------------------ */

const Q_STATUSES: QuestionnaireStatus[] = ["draft", "submitted", "changes_requested", "approved"];

const validQ: Record<QuestionnaireAction["type"], QuestionnaireAction> = {
  submit: { type: "submit", missing: [], signatures: { nda: true, terms: true } },
  request_changes: { type: "request_changes", noteCount: 1, unlocked: ["c_what"] },
  approve: { type: "approve", brands: [{ name: "Kite", questionnaire_scope: null }] },
};

// The whole allowed table (spec §4.1). Everything else must be refused.
const Q_ALLOWED: [QuestionnaireStatus, Actor, QuestionnaireAction["type"], QuestionnaireStatus][] = [
  ["draft", "client", "submit", "submitted"],
  ["changes_requested", "client", "submit", "submitted"],
  ["submitted", "studio", "request_changes", "changes_requested"],
  ["submitted", "studio", "approve", "approved"],
];

describe("questionnaire transitions", () => {
  for (const from of Q_STATUSES) {
    for (const actor of ACTORS) {
      for (const type of Object.keys(validQ) as QuestionnaireAction["type"][]) {
        const allowed = Q_ALLOWED.find(([f, a, t]) => f === from && a === actor && t === type);
        it(`${allowed ? "allows" : "refuses"} ${actor} ${type} from ${from}`, () => {
          const err = errorOf(() => planQuestionnaireTransition(from, actor, validQ[type]));
          if (allowed) {
            expect(err).toBeNull();
            expect(planQuestionnaireTransition(from, actor, validQ[type]).to).toBe(allowed[3]);
          } else {
            expect(err).not.toBeNull();
            expect(["forbidden", "conflict"]).toContain(err!.code);
          }
        });
      }
    }
  }

  it("refuses the wrong actor before looking at the status", () => {
    expect(errorOf(() => planQuestionnaireTransition("draft", "studio", validQ.submit))?.code).toBe("forbidden");
  });

  it("answers a raced status with the friendly conflict message", () => {
    const err = errorOf(() => planQuestionnaireTransition("approved", "client", validQ.submit));
    expect(err?.code).toBe("conflict");
    expect(err?.status).toBe(409);
    expect(err?.message).toBe(CONFLICT_MESSAGE);
  });

  it("requires every answer and both signatures to send", () => {
    const missing = errorOf(() =>
      planQuestionnaireTransition("draft", "client", { type: "submit", missing: ["c_what", "c_who"], signatures: { nda: true, terms: true } }),
    );
    expect(missing?.code).toBe("invalid");
    expect(missing?.message).toContain("2 answers");

    const unsigned = errorOf(() =>
      planQuestionnaireTransition("draft", "client", { type: "submit", missing: [], signatures: { nda: true, terms: false } }),
    );
    expect(unsigned?.code).toBe("invalid");
    expect(unsigned?.message).toContain("the terms");
    expect(unsigned?.details?.unsigned).toEqual(["terms"]);
  });

  it("records submitted vs resubmitted", () => {
    expect(planQuestionnaireTransition("draft", "client", validQ.submit).event.type).toBe("questionnaire.submitted");
    expect(planQuestionnaireTransition("changes_requested", "client", validQ.submit).event.type).toBe(
      "questionnaire.resubmitted",
    );
  });

  it("needs a note and unlocked ids to request changes", () => {
    expect(errorOf(() => planQuestionnaireTransition("submitted", "studio", { type: "request_changes", noteCount: 0, unlocked: ["a"] }))?.code).toBe("invalid");
    expect(errorOf(() => planQuestionnaireTransition("submitted", "studio", { type: "request_changes", noteCount: 1, unlocked: [] }))?.code).toBe("invalid");
    const plan = planQuestionnaireTransition("submitted", "studio", { type: "request_changes", noteCount: 2, unlocked: ["a", "a", "c1:b"] });
    expect(plan.unlocked).toEqual(["a", "c1:b"]);
  });

  it("clears unlocked ids on resend", () => {
    expect(planQuestionnaireTransition("changes_requested", "client", validQ.submit).unlocked).toEqual([]);
  });

  it("creates one brand per agency client, each with its own scope", () => {
    const plan = planQuestionnaireTransition("submitted", "studio", {
      type: "approve",
      brands: [
        { name: " Kite ", questionnaire_scope: "c1" },
        { name: "Hearth", questionnaire_scope: "c2" },
      ],
    });
    expect(plan.brands).toEqual([
      { name: "Kite", questionnaire_scope: "c1" },
      { name: "Hearth", questionnaire_scope: "c2" },
    ]);
    expect(errorOf(() => planQuestionnaireTransition("submitted", "studio", { type: "approve", brands: [] }))?.code).toBe("invalid");
    expect(
      errorOf(() =>
        planQuestionnaireTransition("submitted", "studio", {
          type: "approve",
          brands: [
            { name: "A", questionnaire_scope: "c1" },
            { name: "B", questionnaire_scope: "c1" },
          ],
        }),
      )?.code,
    ).toBe("invalid");
  });
});

/* ------------------------------------------------------------------ */
/* Campaign                                                            */
/* ------------------------------------------------------------------ */

const C_STATUSES: CampaignStatus[] = ["submitted", "in_progress", "review_directions", "in_production", "delivered", "cancelled"];

const three = { directions: [{ id: "v1", title: "Morning Light" }, { id: "v2", title: "Paper" }, { id: "v3", title: "Night" }] };
const DELIVERY = "6f1a3c6e-8a0b-4a49-9b8e-6f6c9b6f6a01";

const validC: Record<CampaignAction["type"], CampaignAction> = {
  accept: { type: "accept" },
  send_directions: { type: "send_directions", items: three },
  approve: { type: "approve", deliveryId: DELIVERY, deliveryItems: three, itemId: "v2" },
  rebuild: { type: "rebuild", deliveryId: DELIVERY, reason: "Too safe", rebuildsUsed: 0 },
  send_final: { type: "send_final", items: { final: { id: "v2" } } },
  cancel: { type: "cancel" },
};

const C_ALLOWED: [CampaignStatus, Actor, CampaignAction["type"], CampaignStatus][] = [
  ["submitted", "studio", "accept", "in_progress"],
  ["in_progress", "studio", "send_directions", "review_directions"],
  ["review_directions", "client", "approve", "in_production"],
  ["review_directions", "client", "rebuild", "in_progress"],
  ["in_production", "studio", "send_final", "delivered"],
  ["submitted", "studio", "cancel", "cancelled"],
  ["in_progress", "studio", "cancel", "cancelled"],
  ["review_directions", "studio", "cancel", "cancelled"],
  ["in_production", "studio", "cancel", "cancelled"],
];

describe("campaign transitions", () => {
  for (const from of C_STATUSES) {
    for (const actor of ACTORS) {
      for (const type of Object.keys(validC) as CampaignAction["type"][]) {
        const allowed = C_ALLOWED.find(([f, a, t]) => f === from && a === actor && t === type);
        it(`${allowed ? "allows" : "refuses"} ${actor} ${type} from ${from}`, () => {
          const err = errorOf(() => planCampaignTransition(from, actor, validC[type]));
          if (allowed) {
            expect(err).toBeNull();
            expect(planCampaignTransition(from, actor, validC[type]).to).toBe(allowed[3]);
          } else {
            expect(err).not.toBeNull();
            expect(["forbidden", "conflict"]).toContain(err!.code);
          }
        });
      }
    }
  }

  it("never cancels a delivered campaign", () => {
    expect(errorOf(() => planCampaignTransition("delivered", "studio", validC.cancel))?.code).toBe("conflict");
  });

  it(`allows at most ${MAX_REBUILDS} rebuilds`, () => {
    expect(planCampaignTransition("review_directions", "client", { ...validC.rebuild, rebuildsUsed: 1 } as CampaignAction).patch.rebuildsInc).toBe(true);
    const err = errorOf(() => planCampaignTransition("review_directions", "client", { ...validC.rebuild, rebuildsUsed: 2 } as CampaignAction));
    expect(err?.code).toBe("invalid");
    expect(err?.message).toBe("You've used both rebuilds. Choose a direction, or write to us.");
  });

  it("requires a reason to rebuild", () => {
    expect(errorOf(() => planCampaignTransition("review_directions", "client", { ...validC.rebuild, reason: "   " } as CampaignAction))?.code).toBe("invalid");
  });

  it("records the decision on the delivery", () => {
    const approve = planCampaignTransition("review_directions", "client", validC.approve);
    expect(approve.patch.approvedItemId).toBe("v2");
    expect(approve.respond).toMatchObject({ deliveryId: DELIVERY, response: { decision: "approve", itemId: "v2" } });
    const rebuild = planCampaignTransition("review_directions", "client", validC.rebuild);
    expect(rebuild.respond).toMatchObject({ response: { decision: "rebuild", reason: "Too safe" } });
  });

  it("only approves a direction from the delivery", () => {
    expect(errorOf(() => planCampaignTransition("review_directions", "client", { ...validC.approve, itemId: "v9" } as CampaignAction))?.code).toBe("invalid");
  });

  it("sends exactly three different directions", () => {
    const two = { directions: three.directions.slice(0, 2) };
    expect(errorOf(() => planCampaignTransition("in_progress", "studio", { type: "send_directions", items: two }))?.code).toBe("invalid");
    const dup = { directions: [three.directions[0], three.directions[0], three.directions[1]] };
    expect(errorOf(() => planCampaignTransition("in_progress", "studio", { type: "send_directions", items: dup }))?.code).toBe("invalid");
    expect(planCampaignTransition("in_progress", "studio", validC.send_directions).newDelivery?.stage).toBe("directions");
  });

  it("creates a final delivery when the final is sent", () => {
    expect(planCampaignTransition("in_production", "studio", validC.send_final).newDelivery?.stage).toBe("final");
  });
});

describe("client labels", () => {
  it("never show internal statuses", () => {
    const allowed = new Set(["Draft", "In review", "Questions for you", "Approved", "Request sent", "In progress", "Ready for your review", "Ready", "Cancelled"]);
    for (const { label } of [...Object.values(questionnaireLabel), ...Object.values(campaignLabel)]) {
      expect(allowed.has(label)).toBe(true);
    }
  });
  it("merges every internal stage into In progress", () => {
    expect(campaignLabel.in_progress.label).toBe("In progress");
    expect(campaignLabel.in_production.label).toBe("In progress");
  });
});
