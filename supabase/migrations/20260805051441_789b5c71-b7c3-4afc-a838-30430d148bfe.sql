CREATE OR REPLACE FUNCTION public.guard_sponsor_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins e chamadas internas (sem auth.uid, ex.: cron/service_role) passam livres.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Reverte silenciosamente qualquer alteração em colunas de moderação/billing.
  NEW.status                 := OLD.status;
  NEW.approved_by            := OLD.approved_by;
  NEW.approved_at            := OLD.approved_at;
  NEW.rejection_reason       := OLD.rejection_reason;
  NEW.guaranteed_impressions := OLD.guaranteed_impressions;
  NEW.delivered_impressions  := OLD.delivered_impressions;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_a_guard_sponsor_privileged ON public.sponsors;
CREATE TRIGGER trg_a_guard_sponsor_privileged
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_sponsor_privileged_columns();