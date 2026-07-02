CREATE OR REPLACE FUNCTION public._sync_in_progress()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(current_setting('app.sync_in_progress', true), '') = 'on';
END; $$;