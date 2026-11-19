/** Row shapes of the dashboard's own tables (migration 20261120000001_client_dashboard.sql). */

export type QuestionnaireStatus = "draft" | "submitted" | "changes_requested" | "approved";

export type CampaignStatus =
  | "submitted"
  | "in_progress"
  | "review_directions"
  | "in_production"
  | "delivered"
  | "cancelled";

export type CampaignKind = "poster" | "single" | "multi";

export interface ClientAccount {
  id: string;
  kind: "brand" | "agency";
  name: string | null;
  contact_email: string | null;
  test: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientBrand {
  id: string;
  account_id: string;
  name: string;
  questionnaire_scope: string | null;
  forma_brand_id: string | null;
  created_at: string;
}

export interface BrandQuestionnaire {
  id: string;
  account_id: string;
  schema_version: number;
  state: Record<string, unknown>;
  status: QuestionnaireStatus;
  unlocked: string[];
  submitted_at: string | null;
  approved_at: string | null;
  version: number;
  updated_at: string;
}

export interface CampaignRequest {
  id: string;
  account_id: string;
  client_brand_id: string;
  name: string;
  setup: { kind: CampaignKind; formats: string[]; languages: string[]; lengths: number[] };
  brief: Record<string, unknown>;
  status: CampaignStatus;
  forma_campaign_id: string | null;
  rebuilds_used: number;
  approved_item_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ClientEvent {
  id: number;
  account_id: string;
  campaign_request_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  at: string;
}
