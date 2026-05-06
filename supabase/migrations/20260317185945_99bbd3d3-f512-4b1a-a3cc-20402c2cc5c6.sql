
CREATE OR REPLACE FUNCTION public.auto_premium_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_providers INTEGER;
BEGIN
  -- Count total approved providers
  SELECT COUNT(*) INTO total_providers FROM public.providers WHERE status = 'approved';
  
  -- Auto-assign premium if total providers <= 500 OR registration date <= 2027-06-30
  IF total_providers <= 500 OR NEW.created_at <= '2027-06-30T23:59:59Z'::timestamptz THEN
    NEW.plan := 'premium';
    NEW.featured := true;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_premium ON public.providers;

-- Create trigger on insert
CREATE TRIGGER trigger_auto_premium
  BEFORE INSERT ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_premium_provider();
