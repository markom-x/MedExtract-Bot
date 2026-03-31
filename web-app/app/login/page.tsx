"use client";

import { Loader2, Mail, ShieldCheck, Stethoscope } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";

import { getSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const nextPath = useMemo(() => params.get("next") || "/", [params]);
  const hasInvalidLinkError =
    params.get("error") === "link_non_valido_o_scaduto";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Inserisci un indirizzo email valido.");
      return;
    }

    try {
      setSending(true);
      const supabase = getSupabaseAuthBrowserClient();
      const redirectTarget = new URL("/auth/confirm", window.location.origin);
      redirectTarget.searchParams.set("next", nextPath);

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectTarget.toString(),
        },
      });

      if (error) {
        toast.error(`Invio non riuscito: ${error.message}`);
        return;
      }

      toast.success("Link inviato! Controlla la tua email.");
      setEmail("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore imprevisto.";
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
            <Stethoscope className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Accesso Dashboard Medica</h1>
            <p className="text-sm text-slate-600">
              Login sicuro con Magic Link Supabase
            </p>
          </div>
        </div>

        {hasInvalidLinkError ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Il link e&apos; scaduto o non valido. Richiedine uno nuovo.
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email professionale
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="medico@studio.it"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-blue-500/30 transition focus:border-blue-500 focus:ring-2"
              autoComplete="email"
              required
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Invio in corso...
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" />
                Invia Link di Accesso
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Riceverai un link monouso via email. Nessuna password da ricordare.
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            <Loader2 className="size-4 animate-spin" />
            Caricamento pagina di accesso...
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
