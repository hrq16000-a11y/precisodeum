CREATE OR REPLACE FUNCTION public._is_blank_text(v text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT v IS NULL OR btrim(v) = ''
$$;