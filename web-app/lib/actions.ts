"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import twilio from "twilio";

import { MEDICO_FILE_SENT, MEDICO_MSG_PREFIX } from "@/lib/dashboard/constants";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type SendDoctorMessageResult =
  | { ok: true }
  | { ok: false; message: string };

function whatsappTo(telefono: string): string {
  const t = telefono.trim();
  if (t.toLowerCase().startsWith("whatsapp:")) return t;
  return `whatsapp:${t}`;
}

function formatPostgrestError(err: PostgrestError): string {
  const parts = [err.message, err.details, err.hint].filter(
    (p): p is string => Boolean(p && String(p).trim())
  );
  return parts.length ? parts.join(" — ") : "Errore sconosciuto dal database.";
}

export type SendDoctorMessageInput = {
  pazienteId: string;
  numeroPaziente: string;
  testo: string;
  urlPubblico?: string | null;
};

/**
 * Flusso: validazione → Twilio API → INSERT Supabase (subito dopo Twilio) → ok.
 * Il messaggio medico è identificato in DB con il prefisso MEDICO_MSG_PREFIX su messaggio_originale.
 */
export async function sendDoctorMessage(
  input: SendDoctorMessageInput
): Promise<SendDoctorMessageResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return {
      ok: false,
      message:
        "Twilio non configurato sul server (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).",
    };
  }

  const testo = input.testo.trim();
  const url = input.urlPubblico?.trim() || null;

  if (!testo && !url) {
    return { ok: false, message: "Inserisci un messaggio o un allegato." };
  }

  const client = twilio(accountSid, authToken);
  const to = whatsappTo(input.numeroPaziente);

  try {
    await client.messages.create({
      from: fromNumber,
      to,
      body: testo || undefined,
      mediaUrl: url ? [url] : undefined,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Errore Twilio durante l'invio del messaggio.";
    return { ok: false, message: msg };
  }

  /* --- Subito dopo Twilio: persistenza su richieste (service role) --- */
  let messaggio_originale: string;
  let riassunto_clinico: string;

  if (url) {
    messaggio_originale = testo
      ? `${MEDICO_MSG_PREFIX} ${testo}`
      : MEDICO_FILE_SENT;
    riassunto_clinico = testo
      ? "Risposta del medico con allegato"
      : "File inviato dal medico";
  } else {
    messaggio_originale = `${MEDICO_MSG_PREFIX} ${testo}`;
    riassunto_clinico = "Risposta del medico";
  }

  try {
    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("richieste")
      .insert({
        paziente_id: input.pazienteId,
        messaggio_originale,
        riassunto_clinico,
        urgenza: "Bassa",
        stato: "Gestito",
        url_media: url,
      })
      .select("id")
      .single();

    if (error) {
      return {
        ok: false,
        message: `WhatsApp inviato correttamente, ma salvataggio su Supabase non riuscito: ${formatPostgrestError(error)}${error.code ? ` (codice: ${error.code})` : ""}`,
      };
    }

    if (!data?.id) {
      return {
        ok: false,
        message:
          "WhatsApp inviato, ma Supabase non ha restituito l'id della riga inserita.",
      };
    }
  } catch (e) {
    const hint =
      e instanceof Error &&
      e.message.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? " Verifica SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL in .env.local lato server."
        : "";
    const msg =
      e instanceof Error
        ? e.message
        : "Errore imprevisto durante l'INSERT su richieste.";
    return {
      ok: false,
      message: `WhatsApp inviato, ma database: ${msg}.${hint}`,
    };
  }

  return { ok: true };
}

export type UpdatePatientNotesResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Aggiorna le note private su `pazienti.note_private` (service role).
 */
export async function updatePatientPrivateNotes(
  pazienteId: string,
  notePrivate: string
): Promise<UpdatePatientNotesResult> {
  try {
    const supabase = getSupabaseServiceRoleClient();
    const { error } = await supabase
      .from("pazienti")
      .update({ note_private: notePrivate.trim() || null })
      .eq("id", pazienteId);

    if (error) {
      return {
        ok: false,
        message: `Salvataggio note non riuscito: ${formatPostgrestError(error)}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : "Errore durante l'aggiornamento delle note.";
    return {
      ok: false,
      message: msg.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? `${msg} Configura SUPABASE_SERVICE_ROLE_KEY sul server.`
        : msg,
    };
  }
}
