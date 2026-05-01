ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.notifications
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

UPDATE public.notifications
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE public.notifications
ALTER COLUMN metadata SET NOT NULL;