import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/Feedback";
import { buttonClass } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Not found" };

/** A link that points nowhere (an old campaign, a typo): say it plainly and lead back. */
export default function NotFound() {
  return (
    <PageContainer className="pt-14">
      <EmptyState
        icon={<SearchIcon size={20} />}
        title="We couldn't find that"
        action={
          <Link href="/" className={buttonClass({ variant: "primary" })}>
            Back to your campaigns
          </Link>
        }
      >
        The link may be old, or the page belongs to another account.
      </EmptyState>
    </PageContainer>
  );
}
