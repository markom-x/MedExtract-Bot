import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserAuthClient: SupabaseClient | null = null;

export function getSupabaseAuthBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Config Supabase mancante: imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (!browserAuthClient) {
    browserAuthClient = createBrowserClient(url, anonKey);
  }

  return browserAuthClient;
}
