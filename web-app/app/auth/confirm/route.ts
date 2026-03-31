import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") || "/";

  const redirectTo = new URL(next, url.origin);
  const supabase = await getSupabaseAuthServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(redirectTo);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error) return NextResponse.redirect(redirectTo);
  }

  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", "link_non_valido_o_scaduto");
  return NextResponse.redirect(loginUrl);
}
