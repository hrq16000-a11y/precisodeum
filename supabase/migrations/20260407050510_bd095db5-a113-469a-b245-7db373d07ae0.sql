-- Add format/sizing/targeting columns to sponsors
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS ad_format text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS max_width integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_height integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_pages text NOT NULL DEFAULT 'all';