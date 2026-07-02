
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS start_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0;

-- RPC to atomically increment click_count
CREATE OR REPLACE FUNCTION public.increment_highlight_clicks(highlight_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.highlights
  SET click_count = click_count + 1
  WHERE id = highlight_id;
$$;
