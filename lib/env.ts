import { z } from "zod";

/**
 * Environment. Validated lazily on first use and once at server boot
 * (instrumentation.ts), so a missing variable fails with a readable message
 * instead of a stack trace deep inside a request.
 */

const flag = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true");

export const serverEnvSchema = z.object({
  SUPABASE_URL: z.url({ message: "must be the project URL, e.g. https://xyz.supabase.co" }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, { message: "is missing (Supabase → Project settings → API → service_role)" }),
  R2_ACCOUNT_ID: z.string().min(1, { message: "is missing (Cloudflare account id)" }),
  R2_ACCESS_KEY_ID: z.string().min(1, { message: "is missing" }),
  R2_SECRET_ACCESS_KEY: z.string().min(1, { message: "is missing" }),
  R2_BUCKET: z.string().min(1).default("forma"),
  NEXT_PUBLIC_PLAYER_ORIGIN: z
    .url({ message: "must be the player origin, e.g. https://play.example.com" })
    .transform((v) => v.replace(/\/+$/, "")),
  DASHBOARD_TEST_MODE: flag,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      "The dashboard is missing configuration:\n" +
        issues.map((i) => `  • ${i}`).join("\n") +
        "\nSee dashboard README → Environment.",
    );
    this.name = "EnvError";
  }
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.join(".") || "env"} ${issue.message}`),
    );
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Server-only configuration. Throws EnvError with every problem listed. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/**
 * Test mode needs no other configuration, so the styleguide and the shell can
 * render before Supabase and R2 are wired.
 */
export function isTestMode(): boolean {
  const v = process.env.DASHBOARD_TEST_MODE;
  return v === "1" || v === "true";
}
