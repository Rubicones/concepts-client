import "server-only";
import { db } from "./supabase";
import { listFormaBrands, type FormaBrand } from "./forma";
import type { QuestionnaireStatus } from "./db-types";

/** Test-mode brand switcher data (spec §6.1): client accounts with their brands, plus Forma brands no account links to. */

export interface SwitcherAccount {
  id: string;
  name: string;
  kind: "brand" | "agency";
  status: QuestionnaireStatus;
  brands: { id: string; name: string }[];
}

export interface SwitcherData {
  accounts: SwitcherAccount[];
  formaBrands: FormaBrand[];
  /** Calm, actionable problems (e.g. the migration isn't applied yet). */
  notices: string[];
}

type AccountRow = {
  id: string;
  name: string | null;
  kind: "brand" | "agency";
  brand_questionnaires: { status: QuestionnaireStatus } | { status: QuestionnaireStatus }[] | null;
  client_brands: { id: string; name: string; forma_brand_id: string | null }[] | null;
};

const MISSING_TABLE = new Set(["42P01", "PGRST205", "PGRST200"]);

export async function getSwitcherData(): Promise<SwitcherData> {
  const notices: string[] = [];

  const [accountsResult, formaResult] = await Promise.allSettled([
    (async () =>
      db()
        .from("client_accounts")
        .select("id, name, kind, brand_questionnaires(status), client_brands(id, name, forma_brand_id)")
        .order("updated_at", { ascending: false }))(),
    listFormaBrands(),
  ]);

  let accounts: SwitcherAccount[] = [];
  const linked = new Set<string>();
  if (accountsResult.status === "fulfilled" && !accountsResult.value.error) {
    for (const row of (accountsResult.value.data ?? []) as unknown as AccountRow[]) {
      const q = Array.isArray(row.brand_questionnaires) ? row.brand_questionnaires[0] : row.brand_questionnaires;
      for (const b of row.client_brands ?? []) if (b.forma_brand_id) linked.add(b.forma_brand_id);
      accounts.push({
        id: row.id,
        name: row.name?.trim() || "New brand",
        kind: row.kind,
        status: q?.status ?? "draft",
        brands: (row.client_brands ?? []).map((b) => ({ id: b.id, name: b.name })),
      });
    }
  } else {
    const err = accountsResult.status === "fulfilled" ? accountsResult.value.error : accountsResult.reason;
    const code = (err as { code?: string } | null)?.code ?? "";
    const name = (err as { name?: string } | null)?.name;
    notices.push(
      MISSING_TABLE.has(code)
        ? "Client accounts aren't in the database yet. Apply forma/supabase/migrations/20261120000001_client_dashboard.sql."
        : name === "EnvError"
          ? "Supabase and R2 aren't configured. See the README → Environment."
          : "Couldn't load client accounts. Check the Supabase settings.",
    );
    if (!MISSING_TABLE.has(code) && name !== "EnvError") console.error("[switcher] accounts:", err);
    accounts = [];
  }

  let formaBrands: FormaBrand[] = [];
  if (formaResult.status === "fulfilled") {
    formaBrands = formaResult.value.filter((b) => !linked.has(b.id));
  } else {
    if ((formaResult.reason as { name?: string })?.name !== "EnvError") {
      console.error("[switcher] Forma brands:", formaResult.reason);
      notices.push("Couldn't load Forma brands from storage. Check the R2 settings.");
    }
  }

  return { accounts, formaBrands, notices };
}
