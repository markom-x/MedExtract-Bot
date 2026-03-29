"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { sendDoctorMessage } from "@/lib/actions";
import { EmptyPatientState } from "@/components/dashboard/empty-state";
import { PatientMainArea } from "@/components/dashboard/patient-main-area";
import { PatientSidebar } from "@/components/dashboard/patient-sidebar";
import {
  groupRichiesteByPatient,
  sortPatientIds,
  type PatientBucket,
} from "@/lib/dashboard/aggregate";
import { fetchRichieste } from "@/lib/dashboard/data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeStorageFileName } from "@/lib/upload/safe-storage-name";

export function DashboardApp() {
  const [buckets, setBuckets] = useState<Map<string, PatientBucket>>(new Map());
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const rows = await fetchRichieste(supabase);
      const map = groupRichiesteByPatient(rows);
      const ids = sortPatientIds(map);
      setBuckets(map);
      setOrderedIds(ids);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Errore durante il caricamento.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedBucket = useMemo(() => {
    if (selectedId == null) return null;
    return buckets.get(selectedId) ?? null;
  }, [buckets, selectedId]);

  async function handleSendMessage(payload: {
    text: string;
    file: File | null;
  }): Promise<boolean> {
    if (selectedId == null || !selectedBucket) return false;
    const { text, file } = payload;
    const trimmed = text.trim();
    if (!trimmed && !file) {
      toast.error("Scrivi un messaggio o allega un file.");
      return false;
    }

    setSending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      let urlPubblico: string | null = null;

      if (file) {
        const path = safeStorageFileName(file.name);
        const { error: uploadError } = await supabase.storage
          .from("referti")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) {
          toast.error(
            `Upload non riuscito: ${uploadError.message}. Verifica policy sul bucket referti.`
          );
          return false;
        }
        const { data } = supabase.storage.from("referti").getPublicUrl(path);
        urlPubblico = data.publicUrl;
      }

      const result = await sendDoctorMessage({
        pazienteId: selectedId,
        numeroPaziente: selectedBucket.profile.telefono,
        testo: trimmed,
        urlPubblico,
      });

      if (!result.ok) {
        toast.error(result.message);
        return false;
      }

      toast.success("Messaggio inviato");
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore imprevisto.");
      return false;
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-slate-50">
        <Loader2 className="size-9 animate-spin text-blue-600" aria-hidden />
        <span className="sr-only">Caricamento…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <p className="max-w-md text-base text-red-800">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-base font-medium text-blue-700 shadow-sm transition hover:bg-slate-50"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (orderedIds.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base leading-relaxed text-slate-700">
            Nessuna richiesta in archivio. Collega Supabase e importa i dati per vedere i
            pazienti.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-slate-50">
      <PatientSidebar
        orderedIds={orderedIds}
        buckets={buckets}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {selectedBucket ? (
        <PatientMainArea
          profile={selectedBucket.profile}
          requests={selectedBucket.requests}
          sending={sending}
          onSendMessage={handleSendMessage}
          onNotesSaved={() => void load()}
        />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden border-l border-slate-200 bg-white">
          <EmptyPatientState />
        </div>
      )}
    </div>
  );
}
