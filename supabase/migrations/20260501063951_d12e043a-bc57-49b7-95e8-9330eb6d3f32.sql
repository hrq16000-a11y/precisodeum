-- ─────────────────────────────────────────────────────────────────────────────
-- Arquivo morto jurídico do cadastro + Bloqueio de re-cadastro 90 dias
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabela imutável (snapshot único por user_id)
CREATE TABLE IF NOT EXISTS public.registration_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identidade do canal de cadastro
  signup_method text,                  -- 'google' | 'email_password' | 'apple' | etc.
  signup_referrer text,                -- document.referrer
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  landing_url text,
  came_from_link boolean DEFAULT false,

  -- Rede
  ip_address text,
  isp text,
  country text,
  region text,
  city_geoip text,

  -- Coordenadas precisas (cliente)
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  was_moving boolean,                  -- velocity > 0.5 m/s
  velocity_mps double precision,

  -- Endereço estruturado declarado
  postal_code text,
  street text,
  street_number text,
  neighborhood text,
  city text,
  state text,

  -- Contato
  whatsapp text,
  email text,

  -- Dispositivo (web só infere via UA; app nativo preenche depois)
  user_agent text,
  device_brand text,                   -- inferido do UA (web) ou Capacitor (nativo)
  device_model text,
  device_imei text,                    -- só preenchível em app nativo Android com permissão
  os_name text,
  os_version text,
  browser_name text,
  browser_version text,
  screen_width int,
  screen_height int,
  device_pixel_ratio numeric,
  language text,
  timezone text,

  -- Estado físico no momento do cadastro
  battery_level numeric,               -- 0..1 ou null
  battery_charging boolean,
  online_at_signup boolean,

  -- Fingerprint composto (para o bloqueio)
  device_fingerprint text,             -- sha256(ua|tela|idioma|tz|dpr)

  -- Origem do cadastro (resumo declarativo do funil)
  origin_summary jsonb DEFAULT '{}'::jsonb,
  raw_meta jsonb DEFAULT '{}'::jsonb,  -- bucket livre

  captured_at timestamptz NOT NULL DEFAULT now(),
  -- Imutabilidade: vetada por trigger BEFORE UPDATE/DELETE abaixo
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regsnap_user ON public.registration_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_regsnap_fingerprint ON public.registration_snapshots(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_regsnap_whatsapp ON public.registration_snapshots(whatsapp);
CREATE INDEX IF NOT EXISTS idx_regsnap_email ON public.registration_snapshots(email);

-- Imutabilidade (zero updates/deletes pelo aplicativo; admin pode forçar via SQL)
CREATE OR REPLACE FUNCTION public.block_registration_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'registration_snapshots is immutable (legal archive)';
END;
$$;

DROP TRIGGER IF EXISTS trg_regsnap_block_update ON public.registration_snapshots;
CREATE TRIGGER trg_regsnap_block_update
  BEFORE UPDATE ON public.registration_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_registration_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_regsnap_block_delete ON public.registration_snapshots;
CREATE TRIGGER trg_regsnap_block_delete
  BEFORE DELETE ON public.registration_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_registration_snapshot_mutation();

ALTER TABLE public.registration_snapshots ENABLE ROW LEVEL SECURITY;

-- Apenas o dono lê seu snapshot
CREATE POLICY "owner_reads_snapshot"
  ON public.registration_snapshots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin lê tudo
CREATE POLICY "admin_reads_all_snapshots"
  ON public.registration_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert apenas via RPC (security definer) — nenhuma policy de INSERT direta.

-- 2. Bloqueio de re-cadastro (90d → permanente)
CREATE TABLE IF NOT EXISTS public.registration_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Fingerprints que não podem se cadastrar de novo
  device_fingerprint text,
  whatsapp text,
  email text,
  postal_code text,
  street_number text,
  ip_address text,
  reason text,                         -- 'self_request' | 'admin_ban' | etc.
  blocked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,              -- now()+90d; quando vira NULL → permanente
  is_permanent boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_regblock_fingerprint ON public.registration_blocks(device_fingerprint) WHERE device_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_regblock_whatsapp ON public.registration_blocks(whatsapp) WHERE whatsapp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_regblock_email ON public.registration_blocks(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_regblock_address ON public.registration_blocks(postal_code, street_number) WHERE postal_code IS NOT NULL;

ALTER TABLE public.registration_blocks ENABLE ROW LEVEL SECURITY;

-- Dono vê o seu próprio bloqueio (saber por que não consegue voltar)
CREATE POLICY "owner_reads_own_block"
  ON public.registration_blocks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = blocked_user_id);

-- Admin lê tudo
CREATE POLICY "admin_reads_all_blocks"
  ON public.registration_blocks
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. RPC para gravar snapshot (idempotente — 1 por user)
CREATE OR REPLACE FUNCTION public.record_registration_snapshot(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT id INTO _existing FROM public.registration_snapshots WHERE user_id = _uid;
  IF _existing IS NOT NULL THEN
    RETURN _existing;  -- imutável: já existe, retorna o mesmo
  END IF;

  INSERT INTO public.registration_snapshots (
    user_id,
    signup_method, signup_referrer,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    landing_url, came_from_link,
    ip_address, isp, country, region, city_geoip,
    latitude, longitude, accuracy_m, was_moving, velocity_mps,
    postal_code, street, street_number, neighborhood, city, state,
    whatsapp, email,
    user_agent, device_brand, device_model, device_imei,
    os_name, os_version, browser_name, browser_version,
    screen_width, screen_height, device_pixel_ratio,
    language, timezone,
    battery_level, battery_charging, online_at_signup,
    device_fingerprint,
    origin_summary, raw_meta
  ) VALUES (
    _uid,
    _payload->>'signup_method', _payload->>'signup_referrer',
    _payload->>'utm_source', _payload->>'utm_medium', _payload->>'utm_campaign', _payload->>'utm_term', _payload->>'utm_content',
    _payload->>'landing_url', COALESCE((_payload->>'came_from_link')::boolean, false),
    _payload->>'ip_address', _payload->>'isp', _payload->>'country', _payload->>'region', _payload->>'city_geoip',
    NULLIF(_payload->>'latitude','')::double precision,
    NULLIF(_payload->>'longitude','')::double precision,
    NULLIF(_payload->>'accuracy_m','')::double precision,
    NULLIF(_payload->>'was_moving','')::boolean,
    NULLIF(_payload->>'velocity_mps','')::double precision,
    _payload->>'postal_code', _payload->>'street', _payload->>'street_number',
    _payload->>'neighborhood', _payload->>'city', _payload->>'state',
    _payload->>'whatsapp', _payload->>'email',
    _payload->>'user_agent', _payload->>'device_brand', _payload->>'device_model', _payload->>'device_imei',
    _payload->>'os_name', _payload->>'os_version', _payload->>'browser_name', _payload->>'browser_version',
    NULLIF(_payload->>'screen_width','')::int,
    NULLIF(_payload->>'screen_height','')::int,
    NULLIF(_payload->>'device_pixel_ratio','')::numeric,
    _payload->>'language', _payload->>'timezone',
    NULLIF(_payload->>'battery_level','')::numeric,
    NULLIF(_payload->>'battery_charging','')::boolean,
    NULLIF(_payload->>'online_at_signup','')::boolean,
    _payload->>'device_fingerprint',
    COALESCE(_payload->'origin_summary', '{}'::jsonb),
    COALESCE(_payload->'raw_meta', '{}'::jsonb)
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_registration_snapshot(jsonb) TO authenticated;

-- 4. RPC para auto-banimento + bloqueio 90d
CREATE OR REPLACE FUNCTION public.request_self_account_ban()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _snap public.registration_snapshots%ROWTYPE;
  _email text;
  _block_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT * INTO _snap FROM public.registration_snapshots WHERE user_id = _uid;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  -- Marca profile como banido (campo opcional; cria se não existir)
  UPDATE public.profiles
     SET banned_at = COALESCE(banned_at, now()),
         ban_reason = COALESCE(ban_reason, 'self_request_account_deletion')
   WHERE id = _uid;

  -- Cria bloqueio com 90 dias (após isso vira permanente via cron simples)
  INSERT INTO public.registration_blocks (
    blocked_user_id, device_fingerprint, whatsapp, email,
    postal_code, street_number, ip_address, reason, expires_at
  ) VALUES (
    _uid,
    _snap.device_fingerprint, _snap.whatsapp, _email,
    _snap.postal_code, _snap.street_number, _snap.ip_address,
    'self_request', now() + interval '90 days'
  ) RETURNING id INTO _block_id;

  -- Cria pedido de exclusão (90d)
  INSERT INTO public.account_deletion_requests (user_id, status, scheduled_for, reason)
  VALUES (_uid, 'pending', now() + interval '90 days', 'self_request')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'block_id', _block_id,
    'banned_at', now(),
    'permanent_after', now() + interval '90 days'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_self_account_ban() TO authenticated;

-- 5. Garantias de schema (campos extras em profiles + account_deletion_requests)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='account_deletion_requests') THEN
    CREATE TABLE public.account_deletion_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending',
      reason text,
      scheduled_for timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "owner_reads_own_deletion_request"
      ON public.account_deletion_requests FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
    CREATE POLICY "admin_reads_all_deletion_requests"
      ON public.account_deletion_requests FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;