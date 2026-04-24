-- 1. Preferências de notificação por canal (JSONB) em providers
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS notification_channels JSONB NOT NULL DEFAULT jsonb_build_object(
    'email',    true,
    'whatsapp', true,
    'push',     true,
    'in_app',   true,
    'sms',      false
  );

COMMENT ON COLUMN public.providers.notification_channels IS
  'Canais de notificação ativos: email, whatsapp, push, in_app, sms';

-- 2. RPC para reagendar manualmente o próximo follow-up de um lead
CREATE OR REPLACE FUNCTION public.reschedule_lead_followup(
  _lead_id UUID,
  _next_at TIMESTAMPTZ,
  _note    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id UUID;
  v_user_id     UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT l.provider_id INTO v_provider_id
  FROM public.leads l
  JOIN public.providers p ON p.id = l.provider_id
  WHERE l.id = _lead_id
    AND (p.user_id = v_user_id OR public.has_role(v_user_id, 'admin'));

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'lead_not_found_or_forbidden';
  END IF;

  IF _next_at <= now() THEN
    RAISE EXCEPTION 'next_followup_must_be_future';
  END IF;

  UPDATE public.leads
     SET next_followup_at          = _next_at,
         last_followup_notified_at = NULL
   WHERE id = _lead_id;

  INSERT INTO public.lead_history (lead_id, author_id, entry_type, message)
  VALUES (
    _lead_id,
    v_user_id,
    'followup_rescheduled',
    COALESCE(_note, 'Follow-up reagendado para ' || to_char(_next_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_lead_followup(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_lead_followup(UUID, TIMESTAMPTZ, TEXT) TO authenticated;