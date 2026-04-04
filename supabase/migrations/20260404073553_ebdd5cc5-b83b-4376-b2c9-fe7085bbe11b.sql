
-- Fix search_path on set_user_ref
CREATE OR REPLACE FUNCTION public.set_user_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  if new.user_ref is null then
    new.user_ref :=
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4);
  end if;
  return new;
end;
$function$;

-- Fix search_path on prevent_user_ref_update
CREATE OR REPLACE FUNCTION public.prevent_user_ref_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  if new.user_ref <> old.user_ref then
    raise exception 'user_ref cannot be changed';
  end if;
  return new;
end;
$function$;

-- Restrict sponsor_metrics INSERT to admin only (tracked via security definer function)
DROP POLICY IF EXISTS "Anyone can insert metrics" ON public.sponsor_metrics;
CREATE POLICY "Admins can insert metrics"
  ON public.sponsor_metrics FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
