CREATE OR REPLACE FUNCTION public.block_registration_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
BEGIN
  RAISE EXCEPTION 'registration_snapshots is immutable (legal archive)';
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_sponsor_invoices_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;