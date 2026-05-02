-- 1) Tabela imutável de histórico de privacidade
CREATE TABLE IF NOT EXISTS public.user_privacy_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'account_deletion','data_export','consent_change','block_triggered','block_expired','login_blocked'
  )),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_privacy_history_user_created
  ON public.user_privacy_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_privacy_history_event_type
  ON public.user_privacy_history (event_type, created_at DESC);

ALTER TABLE public.user_privacy_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_reads_privacy_history" ON public.user_privacy_history;
DROP POLICY IF EXISTS "admin_reads_all_privacy_history" ON public.user_privacy_history;
DROP POLICY IF EXISTS "no_insert_privacy_history" ON public.user_privacy_history;
DROP POLICY IF EXISTS "no_update_privacy_history" ON public.user_privacy_history;
DROP POLICY IF EXISTS "no_delete_privacy_history" ON public.user_privacy_history;

CREATE POLICY "owner_reads_privacy_history" ON public.user_privacy_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin_reads_all_privacy_history" ON public.user_privacy_history
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "no_insert_privacy_history" ON public.user_privacy_history
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "no_update_privacy_history" ON public.user_privacy_history
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "no_delete_privacy_history" ON public.user_privacy_history
  FOR DELETE TO authenticated, anon USING (false);

-- 2) RPC para o próprio usuário registrar eventos
CREATE OR REPLACE FUNCTION public.record_privacy_event(
  _event_type text,
  _reason text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF _event_type NOT IN ('account_deletion','data_export','consent_change','block_triggered','block_expired','login_blocked') THEN
    RAISE EXCEPTION 'invalid event_type: %', _event_type USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_privacy_history (user_id, event_type, reason, metadata, ip_address, user_agent)
  VALUES (v_uid, _event_type, _reason, COALESCE(_metadata, '{}'::jsonb), _ip_address, _user_agent)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_privacy_event(text, text, jsonb, text, text) TO authenticated;

-- 3) self_delete_account passa a gravar histórico
CREATE OR REPLACE FUNCTION public.self_delete_account(_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_snapshot_id uuid;
  v_fingerprint text;
  v_whatsapp text;
  v_ip text;
  v_payload jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  SELECT email, COALESCE(display_name, full_name)
    INTO v_email, v_full_name
  FROM public.profiles WHERE id = v_uid;

  SELECT id, device_fingerprint, whatsapp, ip_address
    INTO v_snapshot_id, v_fingerprint, v_whatsapp, v_ip
  FROM public.registration_snapshots WHERE user_id = v_uid;

  v_payload := jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid),
    'provider', (SELECT to_jsonb(pr) FROM public.providers pr WHERE pr.user_id = v_uid),
    'snapshot_id', v_snapshot_id
  );
  INSERT INTO public.account_cold_storage (user_id, email, reason, payload)
  VALUES (v_uid, v_email, COALESCE(_reason, 'self_request'), v_payload);

  UPDATE public.profiles
     SET status = 'banned_self_request',
         updated_at = now()
   WHERE id = v_uid;

  INSERT INTO public.registration_blocks
    (blocked_user_id, device_fingerprint, whatsapp, email, ip_address, reason, expires_at, is_permanent)
  VALUES
    (v_uid, v_fingerprint, v_whatsapp, v_email, v_ip,
     'self_deletion_180d', now() + interval '180 days', false);

  INSERT INTO public.account_deletion_requests
    (user_id, email, full_name, reason, status, scheduled_for, ip_address)
  VALUES
    (v_uid, COALESCE(v_email, 'unknown@unknown'), v_full_name,
     COALESCE(_reason, 'self_delete'), 'processando', now() + interval '90 days', v_ip)
  ON CONFLICT DO NOTHING;

  -- NOVO: histórico imutável
  INSERT INTO public.user_privacy_history (user_id, event_type, reason, metadata, ip_address)
  VALUES (
    v_uid, 'account_deletion', COALESCE(_reason, 'self_request'),
    jsonb_build_object(
      'cold_storage_days', 90,
      'block_days', 180,
      'block_expires_at', (now() + interval '180 days'),
      'profile_status', 'banned_self_request'
    ),
    v_ip
  );

  RETURN jsonb_build_object('ok', true, 'archived_at', now(), 'purge_after', now() + interval '90 days');
END;
$function$;

-- 4) check_registration_block estendido: separa SELECT do match_via
CREATE OR REPLACE FUNCTION public.check_registration_block(_email text DEFAULT NULL::text, _whatsapp text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_email text := lower(trim(coalesce(_email, '')));
  v_wa text := regexp_replace(coalesce(_whatsapp, ''), '\D', '', 'g');
  v_block public.registration_blocks%ROWTYPE;
  v_matched_via text := 'unknown';
BEGIN
  IF v_email = '' AND v_wa = '' THEN
    RETURN jsonb_build_object('blocked', false);
  END IF;

  SELECT * INTO v_block
  FROM public.registration_blocks
  WHERE (
    (v_email <> '' AND lower(coalesce(email, '')) = v_email)
    OR (v_wa <> '' AND regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_wa)
  )
  AND (is_permanent = true OR (expires_at IS NOT NULL AND expires_at > now()))
  AND coalesce(reason, '') NOT LIKE '%[expired]%'
  ORDER BY blocked_at DESC
  LIMIT 1;

  IF v_block.id IS NULL THEN
    RETURN jsonb_build_object('blocked', false);
  END IF;

  IF v_email <> '' AND lower(coalesce(v_block.email, '')) = v_email THEN
    v_matched_via := 'email';
  ELSIF v_wa <> '' AND regexp_replace(coalesce(v_block.whatsapp, ''), '\D', '', 'g') = v_wa THEN
    v_matched_via := 'whatsapp';
  END IF;

  RETURN jsonb_build_object(
    'blocked', true,
    'reason', coalesce(v_block.reason, 'policy_violation'),
    'matched_via', v_matched_via,
    'permanent', v_block.is_permanent,
    'expires_at', v_block.expires_at,
    'blocked_at', v_block.blocked_at,
    'days_remaining',
      CASE
        WHEN v_block.is_permanent THEN NULL
        WHEN v_block.expires_at IS NOT NULL THEN GREATEST(0, ceil(extract(epoch FROM (v_block.expires_at - now())) / 86400))::int
        ELSE NULL
      END
  );
END;
$function$;