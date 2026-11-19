"use client";

import { createContext, useContext } from "react";
import type { Scope } from "@/questionnaire/logic";
import type { ClientFile, LegalDocs, QuestionnaireNote, QuestionnaireView } from "@/questionnaire/types";
import type { Store } from "./store";

/** Everything the questionnaire's pieces share, so question renderers stay small. */
export interface QCtx {
  view: QuestionnaireView;
  store: Store;
  scope: Scope;
  /** Can this answer key be edited now? (draft: all; questions for you: unlocked only; in review: none) */
  canEdit: (key: string) => boolean;
  readOnly: boolean;
  teamNotes: boolean;
  testMode: boolean;
  /** Open follow-up questions from the studio that concern this answer key. */
  notesFor: (key: string) => QuestionnaireNote[];
  replyFor: (noteId: string) => string;
  setReply: (noteId: string, body: string) => void;
  toast: (title: string, tone?: "info" | "ok" | "err") => void;
  go: (step: string) => void;
  files: ClientFile[];
  uploads: UploadApi;
  legal: LegalDocs;
}

export interface UploadItem {
  /** Local id until the server row exists. */
  key: string;
  fileId?: string;
  name: string;
  size: number;
  scope: string;
  progress: number;
  status: "queued" | "uploading" | "failed";
  error?: string;
}

export interface UploadApi {
  items: UploadItem[];
  add: (files: FileList | File[], scope: string, asBrief?: boolean) => void;
  retry: (key: string) => void;
  cancel: (key: string) => void;
  remove: (fileId: string) => void;
}

export const QContext = createContext<QCtx | null>(null);

export function useQ(): QCtx {
  const c = useContext(QContext);
  if (!c) throw new Error("useQ outside the questionnaire");
  return c;
}
