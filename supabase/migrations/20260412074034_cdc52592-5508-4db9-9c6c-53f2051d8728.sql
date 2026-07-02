
-- Suspension fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suspended_reason text DEFAULT '',
  ADD COLUMN IF NOT EXISTS suspended_by uuid;

-- Add notes column to user_tags if not exists
ALTER TABLE public.user_tags
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
