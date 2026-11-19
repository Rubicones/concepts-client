import type { CampaignStatus } from "@/lib/db-types";
import type { BriefAnswers, CampaignSetup } from "@/lib/brief";
import type { ClientFile } from "@/questionnaire/types";
import type { CommentView } from "./review";
import type { ExportFile } from "./final";

/** Plain data the campaign screens receive from the server. */

export interface BrandOption {
  id: string;
  name: string;
  /** The agency client's questionnaire id ("c1"), or null for a brand account. */
  scope: string | null;
}

export interface DirectionSnapshot {
  id: string;
  title: string;
  idea: string;
  previewEntryId?: string;
  path: string;
  format: string;
  lang: string;
  scenes: string[];
  keyframeSvg: string | null;
  studioNote?: string;
}

export interface FinalSnapshot {
  id: string;
  title: string;
  entryId: string;
  path: string;
  kind: CampaignSetup["kind"];
  formats: string[];
  langs: string[];
  lengths: number[];
}

export interface DeliveryView {
  id: string;
  stage: "directions" | "final";
  round: number;
  status: "sent" | "responded" | "superseded";
  directions: DirectionSnapshot[];
  final: FinalSnapshot | null;
  sentAt: string;
  response: { decision: "approve" | "rebuild"; itemId?: string; reason?: string; at: string } | null;
  respondedAt: string | null;
}

export interface CampaignEvent {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  at: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  setup: CampaignSetup;
  brandId: string;
  updatedAt: string;
  createdAt: string;
  thumbnail: string | null;
}

export interface CampaignDetail extends CampaignSummary {
  version: number;
  brief: BriefAnswers;
  rebuildsUsed: number;
  approvedItemId: string | null;
  brandName: string;
  deliveries: DeliveryView[];
  events: CampaignEvent[];
  refs: ClientFile[];
  /** Comments on every directions round: drafts on the open one, sent ones on earlier rounds. */
  comments: CommentView[];
  /** Files of the latest final delivery, ready or not (empty until Forma's export job writes them). */
  exports: ExportFile[];
}
