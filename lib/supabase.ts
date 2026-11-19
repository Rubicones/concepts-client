import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "./env";

/**
 * Service-role client. Server only: RLS is enabled with no policies, so this key
 * is the only way in, and it must never reach the browser.
 */
let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (!client) {
    const env = serverEnv();
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-client-info": "toggle-dashboard" } },
    });
  }
  return client;
}
