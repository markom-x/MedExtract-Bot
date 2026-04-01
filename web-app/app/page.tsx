import Link from "next/link";
import { Activity, BrainCircuit, MessageCircle, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-dvh bg-white text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900"
          >
            <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
              <Activity className="size-4" />
            </span>
            MedFlow
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Area Medici
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-14 md:px-6 md:pb-16 md:pt-24">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-6xl">
            Il Triage AI per il Medico Moderno.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-600 md:text-xl">
            Trasforma i messaggi WhatsApp dei tuoi pazienti in schede cliniche strutturate.
            Risparmia ore di lavoro ogni giorno, in totale sicurezza.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              Inizia la Prova
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Scopri come funziona
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-4 pb-14 md:px-6 md:pb-20">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <MessageCircle className="size-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Nessuna App da scaricare</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              I pazienti ti scrivono sul tuo assistente virtuale WhatsApp. Nessuna frizione,
              massima accessibilita&apos;.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-teal-50 p-2.5 text-teal-600">
              <BrainCircuit className="size-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Estrazione Dati AI</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Il nostro motore clinico legge i messaggi e genera schede di triage con livelli di
              urgenza e red flags.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <ShieldCheck className="size-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Privacy Garantita</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Architettura Multi-tenant con Row Level Security. I tuoi dati e quelli dei tuoi
              pazienti sono blindati.
            </p>
          </article>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 text-center text-xs text-slate-500 md:px-6">
          © 2024 MedFlow. Progetto per Hackathon HSIL.
        </div>
      </footer>
    </main>
  );
}
