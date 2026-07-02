-- 1) meta_tracking JSONB em providers (consolidação leve, sem migrar dados)
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS meta_tracking jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_providers_meta_tracking ON public.providers USING gin (meta_tracking);
COMMENT ON COLUMN public.providers.meta_tracking IS
  'JSONB consolidado de tracking: network (effectiveType/downlink/rtt), movement (was_moving/velocity_mps), terms (version/accepted_at/ip), referrer_kind. NÃO contém PII bruta — referencia registration_snapshots via user_id.';

-- 2) Colunas novas no registration_snapshots (network + termos)
-- Bypass guard de imutabilidade: ALTER é DDL, não tocada pelo trigger BEFORE UPDATE.
ALTER TABLE public.registration_snapshots
  ADD COLUMN IF NOT EXISTS connection_type text,
  ADD COLUMN IF NOT EXISTS connection_downlink_mbps numeric,
  ADD COLUMN IF NOT EXISTS connection_rtt_ms integer,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- 3) Cold storage 90 dias
CREATE TABLE IF NOT EXISTS public.account_cold_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  archived_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  reason text NOT NULL DEFAULT 'self_request',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cold_storage_purge ON public.account_cold_storage (purge_after);
CREATE INDEX IF NOT EXISTS idx_cold_storage_user ON public.account_cold_storage (user_id);

ALTER TABLE public.account_cold_storage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_reads_cold_storage" ON public.account_cold_storage;
CREATE POLICY "admin_reads_cold_storage"
  ON public.account_cold_storage FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) self_delete_account: atômico, autenticado
CREATE OR REPLACE FUNCTION public.self_delete_account(_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- snapshot (pode não existir se foi cadastro antigo)
  SELECT id, device_fingerprint, whatsapp, ip_address
    INTO v_snapshot_id, v_fingerprint, v_whatsapp, v_ip
  FROM public.registration_snapshots WHERE user_id = v_uid;

  -- 4.1 Cold storage (snapshot resumido — sem duplicar PII pesada)
  v_payload := jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid),
    'provider', (SELECT to_jsonb(pr) FROM public.providers pr WHERE pr.user_id = v_uid),
    'snapshot_id', v_snapshot_id
  );
  INSERT INTO public.account_cold_storage (user_id, email, reason, payload)
  VALUES (v_uid, v_email, COALESCE(_reason, 'self_request'), v_payload);

  -- 4.2 Marca status banned_self_request (sem deletar ainda — mantém integridade referencial)
  UPDATE public.profiles
     SET status = 'banned_self_request',
         updated_at = now()
   WHERE id = v_uid;

  -- 4.3 Block 180 dias (cross-reference fingerprint+email+wa+ip)
  INSERT INTO public.registration_blocks
    (blocked_user_id, device_fingerprint, whatsapp, email, ip_address, reason, expires_at, is_permanent)
  VALUES
    (v_uid, v_fingerprint, v_whatsapp, v_email, v_ip,
     'self_deletion_180d', now() + interval '180 days', false);

  -- 4.4 Registra na fila de deleção (compat com fluxo admin existente)
  INSERT INTO public.account_deletion_requests
    (user_id, email, full_name, reason, status, scheduled_for, ip_address)
  VALUES
    (v_uid, COALESCE(v_email, 'unknown@unknown'), v_full_name,
     COALESCE(_reason, 'self_delete'), 'processando', now() + interval '90 days', v_ip)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'archived_at', now(), 'purge_after', now() + interval '90 days');
END;
$$;

REVOKE ALL ON FUNCTION public.self_delete_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.self_delete_account(text) TO authenticated;

-- 5) Purgas (chamadas por cron)
CREATE OR REPLACE FUNCTION public.purge_cold_storage_91d()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  WITH d AS (
    DELETE FROM public.account_cold_storage
     WHERE purge_after < now()
     RETURNING id
  )
  SELECT count(*) INTO v_count FROM d;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_registration_blocks_180d()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  WITH d AS (
    UPDATE public.registration_blocks
       SET reason = COALESCE(reason,'') || ' [expired]'
     WHERE expires_at IS NOT NULL
       AND expires_at < now()
       AND is_permanent = false
       AND reason NOT LIKE '%[expired]%'
     RETURNING id
  )
  SELECT count(*) INTO v_count FROM d;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_cold_storage_91d() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_registration_blocks_180d() FROM PUBLIC;

-- 6) Cron diário 03:30 (cold storage purge + block expiry)
DO $$
BEGIN
  PERFORM cron.unschedule('lgpd-purge-cold-storage');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('lgpd-expire-registration-blocks');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'lgpd-purge-cold-storage',
  '30 3 * * *',
  $$ SELECT public.purge_cold_storage_91d(); $$
);

SELECT cron.schedule(
  'lgpd-expire-registration-blocks',
  '35 3 * * *',
  $$ SELECT public.expire_registration_blocks_180d(); $$
);