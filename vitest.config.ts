import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // `server-only` throws outside the React server graph; tests exercise server modules directly.
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    // Forma checks (constants, library versions) skip when the repo isn't next door.
    env: { FORMA_DIR: process.env.FORMA_DIR ?? path.resolve(__dirname, "../../forma") },
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
