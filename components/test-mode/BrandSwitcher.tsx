import { getViewerOrNull } from "@/lib/viewer";
import { getSwitcherData } from "@/lib/switcher";
import { getFormaBrand } from "@/lib/forma";
import { BrandSwitcherMenu } from "./BrandSwitcherMenu";

/** Server half of the switcher: who is being viewed + everything that can be picked. Streams behind Suspense. */
export async function BrandSwitcher() {
  // The cookie read comes first: it makes this request-time, so nothing below runs during prerender.
  const viewer = await getViewerOrNull();
  const data = await getSwitcherData();

  let current: { value: string | null; label: string | null } = { value: null, label: null };
  if (viewer?.kind === "account") {
    current = { value: viewer.accountId, label: viewer.account.name ?? "New brand" };
  } else if (viewer?.kind === "forma-brand") {
    const brand =
      data.formaBrands.find((b) => b.id === viewer.formaBrandId) ?? (await getFormaBrand(viewer.formaBrandId).catch(() => null));
    current = { value: `forma:${viewer.formaBrandId}`, label: brand?.name ?? "Forma brand" };
  }
  return <BrandSwitcherMenu data={data} current={current} />;
}
