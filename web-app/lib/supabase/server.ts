import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase con service role — solo lato server (Server Actions, Route Handlers).
 * Richiede SUPABASE_SERVICE_ROLE_KEY (mai esporre al client).
 */
export function getSupabaseServiceRoleClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Config server Supabase mancante: SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
