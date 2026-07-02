CREATE OR REPLACE FUNCTION public.sponsor_has_active_plan(_sponsor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sponsor_subscriptions ss
    WHERE ss.sponsor_id = _sponsor_id
      AND ss.status IN ('active', 'trialing')
      AND (ss.current_period_end IS NULL OR ss.current_period_end >= now())
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_owns_sponsor(_sponsor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sponsor_contacts sc
    WHERE sc.sponsor_id = _sponsor_id
      AND sc.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.sponsors s
    WHERE s.id = _sponsor_id
      AND s.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.log_sponsor_access_event(
  _sponsor_id uuid,
  _event_type text,
  _resource_path text,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.current_user_owns_sponsor(_sponsor_id) AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_user_id,
    CASE
      WHEN _event_type = 'blocked_access' THEN 'block'
      WHEN _event_type IN ('subscription_refresh', 'subscription_changed', 'subscription_renewed') THEN 'subscription_changed'
      ELSE 'update'
    END,
    'sponsor_subscription',
    _sponsor_id::text,
    jsonb_build_object(
      'event_type', _event_type,
      'resource_path', _resource_path,
      'sponsor_id', _sponsor_id
    ) || COALESCE(_details, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sponsor_has_active_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_owns_sponsor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sponsor_access_event(uuid, text, text, jsonb) TO authenticated;

DROP POLICY IF EXISTS "Sponsor owners can update own sponsor" ON public.sponsors;
CREATE POLICY "Sponsor owners can update own sponsor with active plan"
ON public.sponsors
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    user_id = auth.uid()
    AND public.sponsor_has_active_plan(id)
  )
  OR (
    public.current_user_owns_sponsor(id)
    AND public.sponsor_has_active_plan(id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    user_id = auth.uid()
    AND public.sponsor_has_active_plan(id)
  )
  OR (
    public.current_user_owns_sponsor(id)
    AND public.sponsor_has_active_plan(id)
  )
);

DROP POLICY IF EXISTS "Sponsors can view own metrics" ON public.sponsor_metrics;
CREATE POLICY "Sponsors can view own metrics with active plan"
ON public.sponsor_metrics
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.current_user_owns_sponsor(sponsor_id)
    AND public.sponsor_has_active_plan(sponsor_id)
  )
);

DROP POLICY IF EXISTS "Sponsor can insert own campaigns with active plan" ON public.sponsor_campaigns;
CREATE POLICY "Sponsor can insert own campaigns with active plan"
ON public.sponsor_campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.current_user_owns_sponsor(sponsor_id)
    AND public.sponsor_has_active_plan(sponsor_id)
  )
);

DROP POLICY IF EXISTS "Sponsor can update own campaigns with active plan" ON public.sponsor_campaigns;
CREATE POLICY "Sponsor can update own campaigns with active plan"
ON public.sponsor_campaigns
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.current_user_owns_sponsor(sponsor_id)
    AND public.sponsor_has_active_plan(sponsor_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.current_user_owns_sponsor(sponsor_id)
    AND public.sponsor_has_active_plan(sponsor_id)
  )
);

DROP POLICY IF EXISTS "Sponsor can delete own campaigns with active plan" ON public.sponsor_campaigns;
CREATE POLICY "Sponsor can delete own campaigns with active plan"
ON public.sponsor_campaigns
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.current_user_owns_sponsor(sponsor_id)
    AND public.sponsor_has_active_plan(sponsor_id)
  )
);

CREATE OR REPLACE FUNCTION public.audit_sponsor_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_contact_user uuid;
  v_action text := 'subscription_changed';
BEGIN
  SELECT sc.user_id INTO v_contact_user
  FROM public.sponsor_contacts sc
  WHERE sc.sponsor_id = NEW.sponsor_id
  ORDER BY sc.created_at ASC
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_action := 'subscription_created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := 'subscription_changed';
  ELSIF NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
    v_action := 'subscription_changed';
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    COALESCE(v_actor, v_contact_user),
    v_action,
    'sponsor_subscription',
    NEW.id::text,
    jsonb_build_object(
      'sponsor_id', NEW.sponsor_id,
      'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      'new_status', NEW.status,
      'old_period_end', CASE WHEN TG_OP = 'UPDATE' THEN OLD.current_period_end ELSE NULL END,
      'new_period_end', NEW.current_period_end,
      'plan_id', NEW.plan_id,
      'event_type', CASE WHEN TG_OP = 'INSERT' THEN 'subscription_created' ELSE 'subscription_changed' END
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_sponsor_subscription_change ON public.sponsor_subscriptions;
CREATE TRIGGER trg_audit_sponsor_subscription_change
AFTER INSERT OR UPDATE OF status, current_period_end, plan_id ON public.sponsor_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.audit_sponsor_subscription_change();