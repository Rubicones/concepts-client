import Link from "next/link";

/** Thin strip so nobody mistakes test mode for production (spec §6.1). */
export function TestModeBanner() {
  return (
    <div className="relative z-50 bg-deep text-white">
      <div className="mx-auto flex h-8 max-w-[var(--page-max)] items-center justify-between gap-4 px-4 text-caption sm:px-[var(--gutter)]">
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-orange" />
          <span className="font-semibold uppercase tracking-[0.08em]">Test mode</span>
          <span className="text-white/70">No sign-in; everything is visible.</span>
        </p>
        <Link href="/styleguide" className="rounded-tag px-1 text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline">
          Styleguide
        </Link>
      </div>
    </div>
  );
}
