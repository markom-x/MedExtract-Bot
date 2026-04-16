ALTER TABLE public.pazienti
ADD COLUMN IF NOT EXISTS gdpr_consent boolean NOT NULL DEFAULT false;
