import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isTestMode } from "./env";
import { db } from "./supabase";
import { isUuid } from "./r2-keys";
import type { ClientAccount } from "./db-types";

/**
 * The single seam for identity (spec §3.2, §11).
 *
 * Today there is no sign-in: in test mode the brand switcher stores the chosen
 * account in a cookie. When magic-link auth lands, only this file changes: read
 * the session, resolve the account, return the same Viewer shape. Every query
 * downstream is already scoped by `viewer.accountId`.
 */

export const VIEWER_COOKIE = "tc_viewer";

export type Viewer =
  | { kind: "account"; accountId: string; account: ClientAccount; testMode: boolean }
  /** Test mode only: a Forma brand with no client account, opened as a read-only results gallery. */
  | { kind: "forma-brand"; formaBrandId: string; testMode: true };

/** Raw cookie value → what the switcher picked. Exported for tests. */
export function parseViewerCookie(raw: string | undefined):
  | { kind: "account"; id: string }
  | { kind: "forma-brand"; id: string }
  | null {
  if (!raw) return null;
  if (raw.startsWith("forma:")) {
    const id = raw.slice("forma:".length);
    return isUuid(id) ? { kind: "forma-brand", id } : null;
  }
  return isUuid(raw) ? { kind: "account", id: raw } : null;
}

type Picked = ReturnType<typeof parseViewerCookie>;

/** Request-time read (cookie today, session later). Never wrap this in try/catch: during prerender it suspends. */
async function readPicked(): Promise<Picked> {
  if (!isTestMode()) {
    // Production sign-in is not built yet (spec §11). Nobody is a viewer.
    return null;
  }
  return parseViewerCookie((await cookies()).get(VIEWER_COOKIE)?.value);
}

async function resolvePicked(picked: Picked): Promise<Viewer | null> {
  if (!picked) return null;
  if (picked.kind === "forma-brand") return { kind: "forma-brand", formaBrandId: picked.id, testMode: true };
  const { data, error } = await db().from("client_accounts").select("*").eq("id", picked.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { kind: "account", accountId: data.id, account: data as ClientAccount, testMode: true };
}

/** Current viewer, or null when nobody is picked (test mode) or signed in (later). Deduped per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => resolvePicked(await readPicked()));

/**
 * For chrome (top bar): a configuration or network failure degrades to "no viewer"
 * and is logged, instead of breaking the page.
 */
export const getViewerOrNull = cache(async (): Promise<Viewer | null> => {
  const picked = await readPicked();
  try {
    return await resolvePicked(picked);
  } catch (err) {
    console.error("[viewer] could not resolve the viewer:", err);
    return null;
  }
});

export class NoViewerError extends Error {
  constructor() {
    super("Pick a brand to continue.");
    this.name = "NoViewerError";
  }
}

/** For server actions and data loaders that need an account. */
export async function requireAccountViewer(): Promise<Extract<Viewer, { kind: "account" }>> {
  const viewer = await getViewer();
  if (!viewer || viewer.kind !== "account") throw new NoViewerError();
  return viewer;
}

/**
 * Account-scoped select. Use it for every table that carries `account_id`, so a
 * forgotten filter cannot leak another client's rows.
 */
export function scoped(viewer: Extract<Viewer, { kind: "account" }>, table: string, columns = "*") {
  return db().from(table).select(columns).eq("account_id", viewer.accountId);
}
