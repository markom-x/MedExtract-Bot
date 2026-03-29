"use client";

import { UserRound } from "lucide-react";

export function EmptyPatientState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 py-16">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white px-10 py-12 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-blue-700">
          <UserRound className="size-7" strokeWidth={1.5} aria-hidden />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-slate-900">
          Seleziona un paziente
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Scegli un contatto dalla lista a sinistra per vedere il riassunto clinico,
          i referti e la conversazione.
        </p>
      </div>
    </div>
  );
}
