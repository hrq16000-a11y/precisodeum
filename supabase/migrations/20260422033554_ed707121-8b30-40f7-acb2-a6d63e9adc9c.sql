ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS celebration_muted boolean NOT NULL DEFAULT false;