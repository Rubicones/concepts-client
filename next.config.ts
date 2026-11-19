import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  poweredByHeader: false,
  // The NDA and terms are read from legal/*.md at request time.
  outputFileTracingIncludes: { "/**": ["./legal/**/*.md", "./fixtures/exports/**"] },
  // Creative runtime libraries on the player host (proxy.ts keeps them off the app host).
  // CORS: creatives run in an opaque sandbox origin and load three.js as ES modules.
  async headers() {
    return [
      {
        source: "/lib/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    // This app is the root; ignore lockfiles in parent folders.
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
