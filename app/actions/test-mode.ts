"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isTestMode } from "@/lib/env";
import { parseViewerCookie, VIEWER_COOKIE } from "@/lib/viewer";

/**
 * Test mode: pick whose dashboard to look at (spec §6.1). Stored in a cookie;
 * getViewer() reads it. Refused outside test mode.
 */
export async function pickViewer(value: string): Promise<void> {
  if (!isTestMode()) throw new Error("Not available.");
  const picked = parseViewerCookie(value);
  if (!picked) throw new Error("Pick a brand from the list.");
  (await cookies()).set(VIEWER_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(picked.kind === "forma-brand" ? `/gallery/${picked.id}` : "/");
}
