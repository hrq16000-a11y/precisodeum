-- =========================================================
-- MISSÃO 5: Auditoria de cadastro
-- =========================================================

CREATE OR REPLACE VIEW public.provider_audit_view
WITH (security_invoker = true)
AS
WITH first_log AS (
  SELECT DISTINCT ON (user_id)
    user_id, ip_address, isp, city, region, country,
    user_agent, device_type, os, browser, created_at
  FROM public.user_access_logs
  ORDER BY user_id, created_at ASC
),
last_log AS (
  SELECT DISTINCT ON (user_id)
    user_id, ip_address, city, region, country,
    user_agent, device_type, os, browser, created_at
  FROM public.user_access_logs
  ORDER BY user_id, created_at DESC
)
SELECT
  p.id AS provider_id,
  p.user_id,
  p.business_name,
  p.slug,
  p.created_at AS provider_created_at,
  fl.ip_address       AS registration_ip,
  fl.isp              AS registration_isp,
  fl.city             AS registration_city,
  fl.region           AS registration_region,
  fl.country          AS registration_country,
  fl.user_agent       AS registration_user_agent,
  fl.device_type      AS registration_device,
  fl.os               AS registration_os,
  fl.browser          AS registration_browser,
  fl.created_at       AS first_access_at,
  ll.ip_address       AS last_ip,
  ll.device_type      AS last_device,
  ll.os               AS last_os,
  ll.browser          AS last_browser,
  ll.created_at       AS last_access_at
FROM public.providers p
LEFT JOIN first_log fl ON fl.user_id = p.user_id
LEFT JOIN last_log  ll ON ll.user_id = p.user_id
WHERE p.deleted_at IS NULL;

GRANT SELECT ON public.provider_audit_view TO authenticated;

-- RLS hint: a view com security_invoker respeita RLS de providers e user_access_logs.
-- user_access_logs já só permite SELECT a admins, então a view fica naturalmente protegida
-- para os campos de auditoria.

-- Função: prestadores com mesmo IP de cadastro
CREATE OR REPLACE FUNCTION public.admin_providers_same_ip(_min_count integer DEFAULT 2)
RETURNS TABLE(
  ip_address text,
  provider_count bigint,
  providers jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  WITH first_log AS (
    SELECT DISTINCT ON (l.user_id)
      l.user_id, l.ip_address, l.created_at
    FROM public.user_access_logs l
    WHERE l.ip_address IS NOT NULL AND l.ip_address <> ''
    ORDER BY l.user_id, l.created_at ASC
  ),
  joined AS (
    SELECT
      fl.ip_address,
      p.id AS provider_id,
      p.business_name,
      p.slug,
      p.city,
      p.state,
      p.created_at
    FROM first_log fl
    JOIN public.providers p ON p.user_id = fl.user_id
    WHERE p.deleted_at IS NULL
  )
  SELECT
    j.ip_address,
    COUNT(*)::bigint AS provider_count,
    jsonb_agg(jsonb_build_object(
      'provider_id', j.provider_id,
      'business_name', j.business_name,
      'slug', j.slug,
      'city', j.city,
      'state', j.state,
      'created_at', j.created_at
    ) ORDER BY j.created_at) AS providers
  FROM joined j
  GROUP BY j.ip_address
  HAVING COUNT(*) >= _min_count
  ORDER BY COUNT(*) DESC;
END;
$$;

-- =========================================================
-- MISSÃO 3: Migração de "planos" para "níveis" (cota de leads)
-- =========================================================

-- Mapeamento nível -> cota mensal de leads
-- Iniciante / Entusiasta = 3
-- Engajado / Ouro        = 10
-- Platina / Diamante / Mestre = NULL (ilimitado)
CREATE OR REPLACE FUNCTION public.user_lead_quota(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_points integer;
BEGIN
  SELECT gl.min_points INTO v_min_points
  FROM public.profiles p
  LEFT JOIN public.gamification_levels gl ON gl.id = p.level_id
  WHERE p.id = _user_id;

  IF v_min_points IS NULL OR v_min_points < 300 THEN
    RETURN 3;          -- Iniciante (0) e Entusiasta (100)
  ELSIF v_min_points < 1500 THEN
    RETURN 10;         -- Engajado (300) e Ouro (700)
  ELSE
    RETURN NULL;       -- Platina (1500), Diamante (3000), Mestre (5000) = ilimitado
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_lead_quota_usage(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota integer;
  v_used  integer;
  v_provider_id uuid;
BEGIN
  SELECT id INTO v_provider_id
  FROM public.providers
  WHERE user_id = _user_id AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('quota', 0, 'used', 0, 'remaining', 0, 'unlimited', false);
  END IF;

  v_quota := public.user_lead_quota(_user_id);

  SELECT COUNT(*) INTO v_used
  FROM public.leads
  WHERE provider_id = v_provider_id
    AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'quota',     v_quota,
    'used',      v_used,
    'remaining', CASE WHEN v_quota IS NULL THEN NULL ELSE GREATEST(0, v_quota - v_used) END,
    'unlimited', v_quota IS NULL
  );
END;
$$;

-- Trigger de bloqueio: impede inserção de lead quando cota mensal estourou
CREATE OR REPLACE FUNCTION public.enforce_lead_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_quota integer;
  v_used  integer;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.providers
  WHERE id = NEW.provider_id AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_quota := public.user_lead_quota(v_user_id);
  IF v_quota IS NULL THEN
    RETURN NEW; -- ilimitado
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM public.leads
  WHERE provider_id = NEW.provider_id
    AND created_at >= date_trunc('month', now());

  IF v_used >= v_quota THEN
    RAISE EXCEPTION 'lead_quota_exceeded'
      USING HINT = 'O profissional atingiu o limite mensal do nível atual. Suba de nível para receber mais leads.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lead_quota ON public.leads;
CREATE TRIGGER trg_enforce_lead_quota
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_lead_quota();

-- =========================================================
-- MISSÃO 2: Recalc utilitário (sincroniza level_id ignorando plan legado)
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_recalc_provider_levels_from_account()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  cnt integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  FOR rec IN SELECT id FROM public.profiles WHERE engagement_points > 0 LOOP
    PERFORM public.calculate_user_level(rec.id);
    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;
END;
$$;