-- P0-1: subscriptions — WITH CHECK = NULL
DROP POLICY IF EXISTS "Users can create own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can insert subscriptions" ON public.subscriptions;

CREATE POLICY "Users can create own subscription"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = (SELECT user_id FROM public.providers WHERE id = provider_id)
);

CREATE POLICY "Admins can insert subscriptions"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- P0-2: user_roles — WITH CHECK = NULL
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;

CREATE POLICY "Only admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- P0-3: sponsor_leads — UPDATE anon sem restrição de colunas
CREATE OR REPLACE FUNCTION public.trg_fn_restrict_anon_sponsor_lead_update()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'anon' THEN
    IF OLD.email        IS DISTINCT FROM NEW.email        OR
       OLD.phone        IS DISTINCT FROM NEW.phone        OR
       OLD.company_name IS DISTINCT FROM NEW.company_name OR
       OLD.contact_name IS DISTINCT FROM NEW.contact_name THEN
      RAISE EXCEPTION 'Unauthorized: anon cannot modify sensitive fields on sponsor_leads';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_restrict_anon_sponsor_lead_update ON public.sponsor_leads;

CREATE TRIGGER trg_restrict_anon_sponsor_lead_update
  BEFORE UPDATE ON public.sponsor_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_restrict_anon_sponsor_lead_update();