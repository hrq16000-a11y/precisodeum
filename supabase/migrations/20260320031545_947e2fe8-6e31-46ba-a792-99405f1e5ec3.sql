
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS subtitle text DEFAULT '',
  ADD COLUMN IF NOT EXISTS activities text DEFAULT '',
  ADD COLUMN IF NOT EXISTS requirements text DEFAULT '',
  ADD COLUMN IF NOT EXISTS schedule text DEFAULT '',
  ADD COLUMN IF NOT EXISTS salary text DEFAULT '',
  ADD COLUMN IF NOT EXISTS benefits text DEFAULT '';
