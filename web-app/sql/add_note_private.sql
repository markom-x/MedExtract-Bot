-- Esegui in Supabase → SQL Editor (una tantum).
-- Aggiunge le note interne private per paziente (non visibili al paziente).

alter table public.pazienti
  add column if not exists note_private text;

comment on column public.pazienti.note_private is 'Note clinico-amministrative visibili solo in dashboard (non inviate al paziente).';
