import { MEDICO_FILE_SENT, MEDICO_MSG_PREFIX } from "./constants";

/** Placeholder lato backend quando c'è solo un allegato senza caption (es. immagine). */
export function isAllegatoMultimedialePlaceholder(text: string): boolean {
  return text.trim() === "[Allegato Multimediale]";
}

/** Testo mostrato nel bubble (senza prefisso operatore per i messaggi medico). */
export function bubbleMessageText(raw: string, isMedico: boolean): string {
  const t = raw.trim() || "[Messaggio vuoto]";
  if (isMedico && t === MEDICO_FILE_SENT) {
    return "Allegato inviato dal medico";
  }
  if (isMedico && t.startsWith(MEDICO_MSG_PREFIX)) {
    return t.slice(MEDICO_MSG_PREFIX.length).trim() || "[Messaggio vuoto]";
  }
  return t;
}
