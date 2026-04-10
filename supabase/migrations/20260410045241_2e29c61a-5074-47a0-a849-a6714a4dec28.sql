
-- Add rich media and targeting columns to notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS target_group text DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS sent_by uuid;
