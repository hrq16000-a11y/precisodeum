DROP POLICY IF EXISTS "Anon can attach docs to unclaimed recent lead" ON public.sponsor_leads;

CREATE POLICY "Anon attach unclaimed lead docs"
  ON public.sponsor_leads
  FOR UPDATE
  TO anon
  USING (
    user_id IS NULL
    AND created_at > (now() - interval '24 hours')
  )
  WITH CHECK (
    user_id IS NULL
    AND created_at > (now() - interval '24 hours')
  );

CREATE OR REPLACE FUNCTION public.restrict_anon_lead_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role') = 'anon' THEN
    IF (NEW.status IS DISTINCT FROM OLD.status)
    OR (NEW.email IS DISTINCT FROM OLD.email)
    OR (NEW.phone IS DISTINCT FROM OLD.phone)
    OR (NEW.user_id IS DISTINCT FROM OLD.user_id)
    OR (NEW.company_name IS DISTINCT FROM OLD.company_name)
    OR (NEW.cnpj IS DISTINCT FROM OLD.cnpj)
    OR (NEW.plan IS DISTINCT FROM OLD.plan)
    OR (NEW.docs_reviewed_by IS DISTINCT FROM OLD.docs_reviewed_by)
    OR (NEW.docs_review_notes IS DISTINCT FROM OLD.docs_review_notes) THEN
      RAISE EXCEPTION 'Unauthorized column update by anon';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_anon_lead_update ON public.sponsor_leads;
CREATE TRIGGER trg_restrict_anon_lead_update
  BEFORE UPDATE ON public.sponsor_leads
  FOR EACH ROW EXECUTE FUNCTION public.restrict_anon_lead_update();