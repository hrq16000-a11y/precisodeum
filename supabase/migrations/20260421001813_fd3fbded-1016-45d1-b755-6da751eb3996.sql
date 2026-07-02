-- 1) PROFILES: trial boost + checklist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_boost_until timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_checklist_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_trial_boost ON public.profiles(trial_boost_until) WHERE trial_boost_until IS NOT NULL;

-- 2) PROVIDERS: cache de tempo médio de resposta
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS avg_response_minutes integer,
  ADD COLUMN IF NOT EXISTS last_response_calc_at timestamptz;

-- 3) RPC: completar checklist e ativar boost (7 dias)
CREATE OR REPLACE FUNCTION public.complete_onboarding_checklist()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_provider RECORD;
  v_profile RECORD;
  v_already_done timestamptz;
  v_boost_until timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile.profile_type NOT IN ('provider','rh') THEN
    RAISE EXCEPTION 'Apenas profissionais podem ativar o boost';
  END IF;

  -- Idempotência: se já concedido nas últimas 24h, retorna o existente
  IF v_profile.trial_boost_until IS NOT NULL AND v_profile.trial_boost_until > now() THEN
    RETURN jsonb_build_object(
      'status','already_active',
      'boost_until', v_profile.trial_boost_until
    );
  END IF;

  SELECT * INTO v_provider FROM public.providers WHERE user_id = v_user_id AND deleted_at IS NULL LIMIT 1;
  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'Perfil profissional não encontrado';
  END IF;

  -- Validação server-side dos 5 passos
  IF NOT (
    (COALESCE(v_provider.photo_url,'') <> '' OR COALESCE(v_profile.avatar_url,'') <> '') AND
    (COALESCE(v_profile.whatsapp,'') <> '' OR COALESCE(v_profile.phone,'') <> '' OR COALESCE(v_provider.whatsapp,'') <> '' OR COALESCE(v_provider.phone,'') <> '') AND
    (COALESCE(v_provider.city,'') <> '' AND v_provider.city <> 'Não informada' AND COALESCE(v_provider.state,'') <> '') AND
    (length(COALESCE(v_provider.description,'')) >= 30) AND
    (COALESCE(v_provider.services_count,0) >= 1)
  ) THEN
    RAISE EXCEPTION 'Checklist incompleto. Conclua os 5 passos antes de ativar o boost.';
  END IF;

  v_boost_until := now() + interval '7 days';

  UPDATE public.profiles
  SET trial_boost_until = v_boost_until,
      onboarding_checklist_completed_at = COALESCE(onboarding_checklist_completed_at, now()),
      updated_at = now()
  WHERE id = v_user_id;

  -- Pontos de gamificação (idempotente via cooldown da própria função)
  PERFORM public.award_engagement_points(v_user_id, 'profile_completed',
    jsonb_build_object('source','onboarding_checklist','boost_days',7));

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (v_user_id, 'trial_boost_granted','profile', v_user_id::text,
          jsonb_build_object('boost_until', v_boost_until));

  RETURN jsonb_build_object('status','granted','boost_until', v_boost_until);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding_checklist() TO authenticated;

-- 4) RPC: calcular tempo médio de resposta de um profissional
CREATE OR REPLACE FUNCTION public.calc_provider_avg_response(_provider_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_avg_min integer;
BEGIN
  SELECT user_id INTO v_user_id FROM providers WHERE id = _provider_id AND deleted_at IS NULL;
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  -- Tempo médio entre criação da conversa e 1ª mensagem do profissional
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (first_msg.created_at - c.created_at))/60))::integer
  INTO v_avg_min
  FROM chat_conversations c
  JOIN LATERAL (
    SELECT m.created_at FROM chat_messages m
    WHERE m.conversation_id = c.id AND m.sender_id = v_user_id
    ORDER BY m.created_at ASC LIMIT 1
  ) first_msg ON true
  WHERE (c.participant_a = v_user_id OR c.participant_b = v_user_id)
    AND c.created_at > now() - interval '60 days';

  UPDATE providers
  SET avg_response_minutes = v_avg_min,
      last_response_calc_at = now()
  WHERE id = _provider_id;

  RETURN v_avg_min;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calc_provider_avg_response(uuid) TO authenticated, anon;

-- 5) RPC: pinned sponsor para search (categoria + cidade)
CREATE OR REPLACE FUNCTION public.get_pinned_sponsor_for_search(
  _category_slug text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL
)
RETURNS TABLE (
  sponsor_id uuid,
  title text,
  company_name text,
  image_url text,
  logo_url text,
  link_url text,
  short_description text,
  whatsapp text,
  phone text,
  assignment_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.company_name, s.image_url, s.logo_url, s.link_url,
         s.short_description, s.whatsapp, s.phone, a.id AS assignment_id
  FROM ad_slot_assignments a
  JOIN ad_slots sl ON sl.id = a.slot_id AND sl.slug = 'search-pinned' AND sl.active = true
  JOIN sponsors s ON s.id = a.sponsor_id AND s.active = true AND s.status = 'active'
  WHERE a.active = true
    AND (a.start_date IS NULL OR a.start_date <= now())
    AND (a.end_date IS NULL OR a.end_date >= now())
    AND (a.target_category IS NULL OR a.target_category = _category_slug)
    AND (a.target_city IS NULL OR LOWER(a.target_city) = LOWER(COALESCE(_city,'')))
    AND (a.target_state IS NULL OR UPPER(a.target_state) = UPPER(COALESCE(_state,'')))
  ORDER BY
    -- Mais específico vence
    (CASE WHEN a.target_category IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN a.target_city IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN a.target_state IS NOT NULL THEN 1 ELSE 0 END) DESC,
    a.priority DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_pinned_sponsor_for_search(text,text,text) TO authenticated, anon;

-- 6) Seed do slot search-pinned
INSERT INTO public.ad_slots (slug, name, description, page_type, max_ads, active, display_order)
VALUES ('search-pinned','Patrocínio Exclusivo da Busca','Card patrocinado fixo no topo dos resultados de busca, segmentado por categoria e/ou cidade. Identificado como Patrocinado.','search',1,true,0)
ON CONFLICT (slug) DO NOTHING;