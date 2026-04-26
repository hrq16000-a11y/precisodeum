CREATE OR REPLACE FUNCTION public.trg_normalize_state_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.state := COALESCE(public.normalize_uf(NEW.state), '');
  RETURN NEW;
END;
$$;