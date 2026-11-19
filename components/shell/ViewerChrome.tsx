import { unstable_rethrow } from "next/navigation";
import { getViewer, type Viewer } from "@/lib/viewer";
import { AccountMenu } from "./AccountMenu";

/**
 * Viewer-dependent parts of the top bar. They read the cookie, so they stream in
 * behind Suspense while the rest of the shell prerenders (Cache Components).
 * A configuration or network problem degrades to an anonymous bar, never a blank page.
 */
async function safeViewer(): Promise<Viewer | null> {
  try {
    return await getViewer();
  } catch (err) {
    // Let Next's own control flow (prerender bail-out, redirects) through untouched.
    unstable_rethrow(err);
    console.error("[shell] could not resolve the viewer:", err);
    return null;
  }
}

export async function ViewerBrand() {
  const viewer = await safeViewer();
  if (viewer?.kind !== "account") return null;
  return <span>{viewer.account.name ?? "New brand"}</span>;
}

export async function ViewerAccount() {
  const viewer = await safeViewer();
  if (viewer?.kind === "account") {
    return (
      <AccountMenu
        name={viewer.account.name ?? "New brand"}
        kindLabel={viewer.account.kind === "agency" ? "Agency account" : "Brand account"}
      />
    );
  }
  return <AccountMenu name={null} />;
}
