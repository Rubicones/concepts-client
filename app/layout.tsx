import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { isTestMode } from "@/lib/env";
import { TestModeBanner } from "@/components/shell/TestModeBanner";
import { TopBar } from "@/components/shell/TopBar";
import { ViewerAccount, ViewerBrand } from "@/components/shell/ViewerChrome";
import { BrandSwitcher } from "@/components/test-mode/BrandSwitcher";
import { Shortcuts } from "@/components/shell/Shortcuts";

// Inter Tight (SIL OFL 1.1), self-hosted variable font: no request to Google at build or runtime.
const interTight = localFont({
  src: "./fonts/InterTight-latin-var.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  variable: "--font-inter-tight",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: { default: "Toggle Concepts", template: "%s · Toggle Concepts" },
  description: "Your campaigns with Toggle Concepts.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const testMode = isTestMode();
  return (
    <html lang="en" className={`${interTight.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only z-[200] rounded-full bg-navy px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to content
          </a>
          {testMode && <TestModeBanner />}
          <TopBar
            brand={
              testMode ? (
                <Suspense fallback={<span aria-hidden="true" className="skeleton block h-10 w-48 rounded-full" />}>
                  <BrandSwitcher />
                </Suspense>
              ) : (
                <Suspense fallback={null}>
                  <ViewerBrand />
                </Suspense>
              )
            }
            account={
              <Suspense fallback={<span aria-hidden="true" className="skeleton size-8 rounded-full" />}>
                <ViewerAccount />
              </Suspense>
            }
          />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <Suspense fallback={null}>
            <Shortcuts testMode={testMode} />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
