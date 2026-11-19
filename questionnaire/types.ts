import type { QuestionnaireStatus } from "@/lib/db-types";
import type { RenderedDoc, LegalDocKey } from "@/lib/legal-parse";
import type { QState } from "./logic";

/** What the questionnaire page receives from the server. Plain data, safe for the browser. */

export interface QuestionnaireNote {
  id: string;
  authorRole: "studio" | "client";
  questionIds: string[];
  body: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ClientFile {
  id: string;
  scope: string;
  name: string;
  size: number;
  category: string;
  status: "uploading" | "ready" | "failed";
  createdAt: string;
}

export interface QuestionnaireView {
  id: string;
  accountId: string;
  status: QuestionnaireStatus;
  version: number;
  state: QState;
  unlocked: string[];
  submittedAt: string | null;
  approvedAt: string | null;
  updatedAt: string;
  notes: QuestionnaireNote[];
  files: ClientFile[];
}

export type LegalDocs = Record<LegalDocKey, RenderedDoc>;

/** A change to send: answers to set (null clears), flags to set, and top-level fields. */
export interface QPatch {
  a?: Record<string, unknown>;
  flags?: Record<string, "file" | "prefill" | null>;
  meta?: {
    role?: QState["role"];
    mode?: QState["mode"];
    clients?: QState["clients"];
    legal?: { company?: string; name?: string; caseStudy?: boolean };
  };
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: "conflict" | "locked" | "invalid" | "not_found" | "forbidden" };
