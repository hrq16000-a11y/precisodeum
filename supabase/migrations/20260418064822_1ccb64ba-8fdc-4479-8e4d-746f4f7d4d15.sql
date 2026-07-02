-- 1. Add new resource columns to tier_rules
ALTER TABLE public.tier_rules
  ADD COLUMN IF NOT EXISTS can_view_client_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_use_advanced_dashboard boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS top_search_placement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_badge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS radius_km integer NOT NULL DEFAULT 50;

-- 2. Insert sponsor tier (idempotent)
INSERT INTO public.tier_rules (
  tier_key, tier_label,
  max_services, max_leads, max_ads, max_slots,
  can_create_services, can_receive_leads,
  can_access_crm, can_access_reports, can_access_featured,
  can_view_client_phone, can_use_advanced_dashboard, top_search_placement, verified_badge,
  ranking_priority, search_boost, radius_km
)
SELECT 'sponsor', 'Patrocinador',
  -1, -1, -1, -1,
  true, true,
  true, true, true,
  true, true, true, true,
  100, 50, 200
WHERE NOT EXISTS (SELECT 1 FROM public.tier_rules WHERE tier_key = 'sponsor');

-- 3. gamification_levels: add JSONB column for explicit "feature unlocks" (perfil é base, nível adiciona bônus)
ALTER TABLE public.gamification_levels
  ADD COLUMN IF NOT EXISTS feature_unlocks jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.gamification_levels.feature_unlocks IS
  'JSON com toggles que o nível libera além do tier base. Ex: {"verified_badge": true, "can_view_client_phone": true, "can_use_advanced_dashboard": true, "top_search_placement": true}';

-- 4. Function: effective permissions (perfil base + nível bônus, NUNCA reduz)
CREATE OR REPLACE FUNCTION public.effective_user_permissions(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_type text;
  v_level_id uuid;
  v_is_sponsor boolean;
  v_tier_key text;
  v_tier RECORD;
  v_unlocks jsonb;
  v_result jsonb;
BEGIN
  SELECT p.profile_type, p.level_id, public.is_sponsor(p.id)
    INTO v_profile_type, v_level_id, v_is_sponsor
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  -- Sponsor sempre vence como tier base
  IF v_is_sponsor THEN
    v_tier_key := 'sponsor';
  ELSE
    v_tier_key := CASE v_profile_type
      WHEN 'provider' THEN 'free_provider'
      WHEN 'rh'       THEN 'free_rh'
      WHEN 'client'   THEN 'free_client'
      ELSE 'other'
    END;
  END IF;

  SELECT * INTO v_tier FROM public.tier_rules WHERE tier_key = v_tier_key LIMIT 1;
  IF v_tier IS NULL THEN
    SELECT * INTO v_tier FROM public.tier_rules WHERE tier_key = 'free_client' LIMIT 1;
  END IF;

  -- Bônus do nível (apenas adiciona, nunca remove)
  SELECT COALESCE(feature_unlocks, '{}'::jsonb) INTO v_unlocks
  FROM public.gamification_levels WHERE id = v_level_id;
  v_unlocks := COALESCE(v_unlocks, '{}'::jsonb);

  v_result := jsonb_build_object(
    'tier_key', v_tier.tier_key,
    'tier_label', v_tier.tier_label,
    'max_services', v_tier.max_services,
    'max_leads', v_tier.max_leads,
    'max_ads', v_tier.max_ads,
    'max_slots', v_tier.max_slots,
    'radius_km', v_tier.radius_km,
    'ranking_priority', v_tier.ranking_priority,
    'search_boost', v_tier.search_boost,
    'can_create_services',        v_tier.can_create_services,
    'can_receive_leads',          v_tier.can_receive_leads,
    'can_access_crm',             v_tier.can_access_crm OR COALESCE((v_unlocks->>'can_access_crm')::boolean, false),
    'can_access_reports',         v_tier.can_access_reports OR COALESCE((v_unlocks->>'can_access_reports')::boolean, false),
    'can_access_featured',        v_tier.can_access_featured OR COALESCE((v_unlocks->>'can_access_featured')::boolean, false),
    'can_view_client_phone',      v_tier.can_view_client_phone OR COALESCE((v_unlocks->>'can_view_client_phone')::boolean, false),
    'can_use_advanced_dashboard', v_tier.can_use_advanced_dashboard OR COALESCE((v_unlocks->>'can_use_advanced_dashboard')::boolean, false),
    'top_search_placement',       v_tier.top_search_placement OR COALESCE((v_unlocks->>'top_search_placement')::boolean, false),
    'verified_badge',             v_tier.verified_badge OR COALESCE((v_unlocks->>'verified_badge')::boolean, false)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.effective_user_permissions(uuid) TO authenticated;

-- 5. Admin RPC: migrar manualmente um usuário entre níveis (override)
CREATE OR REPLACE FUNCTION public.admin_assign_user_level(_user_id uuid, _level_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old uuid;
  v_exists boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.gamification_levels WHERE id = _level_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Nível inexistente';
  END IF;

  SELECT level_id INTO v_old FROM public.profiles WHERE id = _user_id;

  UPDATE public.profiles SET level_id = _level_id WHERE id = _user_id;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'admin_assign_user_level',
    'profile',
    _user_id::text,
    jsonb_build_object('old_level_id', v_old, 'new_level_id', _level_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_user_level(uuid, uuid) TO authenticated;