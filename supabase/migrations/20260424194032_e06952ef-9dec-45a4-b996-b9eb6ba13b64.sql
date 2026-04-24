-- Auto-fill user_id on sponsor_leads insert when an authenticated user submits the form
CREATE OR REPLACE FUNCTION public.set_sponsor_lead_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_sponsor_lead_user_id ON public.sponsor_leads;
CREATE TRIGGER trg_set_sponsor_lead_user_id
BEFORE INSERT ON public.sponsor_leads
FOR EACH ROW
EXECUTE FUNCTION public.set_sponsor_lead_user_id();

-- Enable realtime on sponsor_leads (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sponsor_leads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.sponsor_leads REPLICA IDENTITY FULL;