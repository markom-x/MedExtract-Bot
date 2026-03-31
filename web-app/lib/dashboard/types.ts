export type PazienteNested = {
  /** UUID testuale da Supabase */
  id: string;
  nome: string | null;
  telefono: string | null;
  note_private?: string | null;
};

export type RichiestaRow = {
  /** UUID testuale della riga `richieste` */
  id: string;
  created_at: string;
  stato: string | null;
  urgenza: string | null;
  riassunto_clinico: string | null;
  messaggio_originale: string | null;
  url_media: string | null;
  pazienti: PazienteNested | PazienteNested[] | null;
};

export type PatientProfile = {
  /** UUID testuale da `pazienti.id` */
  id: string;
  nomeRaw: string | null;
  nomeDisplay: string;
  telefono: string;
  /** Note interne (colonna note_private su pazienti) */
  notePrivate: string | null;
};
