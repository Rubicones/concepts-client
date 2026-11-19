/**
 * Runs once when the server starts. Fails fast with a readable list when
 * configuration is missing, instead of erroring on the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { serverEnv } = await import("./lib/env");
  serverEnv();
}
