"use client";

import { Activity, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

export default function DashboardPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseAuthBrowserClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="relative min-h-dvh bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(6,182,212,0.12),transparent_42%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.12),transparent_45%)]"
        aria-hidden
      />
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/25">
              <Activity className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white md:text-xl">
                Dashboard MedFlow
              </h1>
              <p className="text-xs text-slate-500 md:text-sm">Area riservata professionisti sanitari</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="size-4" />
            {signingOut ? "Uscita…" : "Logout"}
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
        <section className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-6 shadow-xl shadow-black/20 backdrop-blur-sm md:p-8">
          <p className="text-sm leading-relaxed text-slate-400">
            Benvenuto nella console MedFlow. Da qui potrai gestire triage e conversazioni quando le
            funzionalità saranno collegate.
          </p>
          <p className="mt-4 text-xs text-slate-600">
            <Link href="/" className="text-cyan-500/90 underline-offset-2 hover:text-cyan-400 hover:underline">
              Torna al sito pubblico
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
