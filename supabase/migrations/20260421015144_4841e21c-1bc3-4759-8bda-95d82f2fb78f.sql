
-- 1. REFERRAL CODE no profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := UPPER(SUBSTR(MD5(RANDOM()::TEXT || clock_timestamp()::TEXT), 1, 8));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_set_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_referral_code ON public.profiles;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_referral_code();

-- Backfill existing profiles
UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;

-- 2. TABELA REFERRALS
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed
  completed_at TIMESTAMPTZ,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users create referral as referred"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_id);

CREATE POLICY "Admin manages all referrals"
  ON public.referrals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. RPC: registrar indicação no signup
CREATE OR REPLACE FUNCTION public.register_referral(_referred_id UUID, _referral_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  IF _referral_code IS NULL OR _referral_code = '' THEN RETURN FALSE; END IF;
  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = UPPER(_referral_code);
  IF v_referrer_id IS NULL OR v_referrer_id = _referred_id THEN RETURN FALSE; END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status)
  VALUES (v_referrer_id, _referred_id, UPPER(_referral_code), 'pending')
  ON CONFLICT (referred_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- 4. RPC: completar referral e premiar
CREATE OR REPLACE FUNCTION public.complete_referral(_referred_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
  v_points INT := 100;
BEGIN
  SELECT * INTO v_ref FROM referrals WHERE referred_id = _referred_id AND status = 'pending';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Award both
  UPDATE profiles SET engagement_points = engagement_points + v_points WHERE id = v_ref.referrer_id;
  UPDATE profiles SET engagement_points = engagement_points + v_points WHERE id = _referred_id;

  INSERT INTO engagement_log (user_id, action_key, points_awarded, metadata)
  VALUES
    (v_ref.referrer_id, 'referral_completed', v_points, jsonb_build_object('referred_id', _referred_id)),
    (_referred_id, 'referral_signup', v_points, jsonb_build_object('referrer_id', v_ref.referrer_id));

  UPDATE referrals
    SET status = 'completed', completed_at = now(), points_awarded = v_points
    WHERE id = v_ref.id;

  -- Notify referrer
  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (v_ref.referrer_id, 'Indicação completada! +100 pontos',
    'Seu indicado concluiu o cadastro. Você ganhou 100 pontos de engajamento.',
    'gamification', '/dashboard/indicacoes');

  RETURN TRUE;
END;
$$;

-- 5. RPC: Saúde do Perfil (0-100) com sugestões
CREATE OR REPLACE FUNCTION public.get_profile_health_score(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider RECORD;
  v_profile RECORD;
  v_score INT := 0;
  v_suggestions JSONB := '[]'::JSONB;
  v_lead_count INT;
  v_review_count INT;
  v_avg_response NUMERIC;
BEGIN
  SELECT * INTO v_provider FROM providers WHERE user_id = _user_id AND deleted_at IS NULL;
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;

  IF v_provider.id IS NULL THEN
    RETURN jsonb_build_object('score', 0, 'suggestions', '[]'::jsonb, 'breakdown', '{}'::jsonb);
  END IF;

  -- Photo (15 pts)
  IF v_profile.avatar_url IS NOT NULL AND v_profile.avatar_url <> '' THEN
    v_score := v_score + 15;
  ELSE
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 1, 'icon', 'Camera',
      'text', 'Adicione uma foto de perfil. Perfis com foto recebem 7x mais cliques.',
      'action', '/dashboard/perfil');
  END IF;

  -- Description (20 pts)
  IF length(COALESCE(v_provider.description, '')) >= 200 THEN
    v_score := v_score + 20;
  ELSIF length(COALESCE(v_provider.description, '')) >= 50 THEN
    v_score := v_score + 10;
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 2, 'icon', 'FileText',
      'text', 'Sua descrição está curta. Perfis com 200+ caracteres convertem 3x mais.',
      'action', '/dashboard/perfil');
  ELSE
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 1, 'icon', 'FileText',
      'text', 'Adicione uma descrição completa do seu trabalho (mínimo 200 caracteres).',
      'action', '/dashboard/perfil');
  END IF;

  -- Services (15 pts)
  IF COALESCE(v_provider.services_count, 0) >= 3 THEN
    v_score := v_score + 15;
  ELSIF v_provider.services_count >= 1 THEN
    v_score := v_score + 8;
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 3, 'icon', 'Briefcase',
      'text', 'Cadastre 3+ serviços para aparecer em mais buscas.',
      'action', '/dashboard/servicos');
  ELSE
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 1, 'icon', 'Briefcase',
      'text', 'Cadastre seu primeiro serviço para começar a receber leads.',
      'action', '/dashboard/servicos');
  END IF;

  -- Portfolio (10 pts)
  IF COALESCE(v_provider.portfolio_photo_count, 0) >= 5 THEN
    v_score := v_score + 10;
  ELSIF v_provider.portfolio_photo_count > 0 THEN
    v_score := v_score + 5;
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 4, 'icon', 'Image',
      'text', 'Adicione 5+ fotos no portfólio para gerar confiança.',
      'action', '/dashboard/portfolio');
  ELSE
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 2, 'icon', 'Image',
      'text', 'Suba fotos do seu trabalho. Portfólios visuais convertem 5x mais.',
      'action', '/dashboard/portfolio');
  END IF;

  -- Contact (10 pts)
  IF v_provider.whatsapp IS NOT NULL AND v_provider.whatsapp <> '' THEN
    v_score := v_score + 10;
  ELSE
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 1, 'icon', 'Phone',
      'text', 'Adicione seu WhatsApp para receber contatos diretos.',
      'action', '/dashboard/perfil');
  END IF;

  -- Location (5 pts)
  IF v_provider.city IS NOT NULL AND v_provider.city <> '' THEN
    v_score := v_score + 5;
  END IF;

  -- Reviews (10 pts)
  v_review_count := COALESCE(v_provider.review_count, 0);
  IF v_review_count >= 5 THEN
    v_score := v_score + 10;
  ELSIF v_review_count >= 1 THEN
    v_score := v_score + 5;
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 3, 'icon', 'Star',
      'text', 'Peça avaliações aos clientes. 5+ reviews aumentam suas conversões.',
      'action', '/dashboard/avaliacoes');
  END IF;

  -- Conversions (10 pts)
  SELECT COUNT(*) INTO v_lead_count FROM leads WHERE provider_id = v_provider.id;
  IF v_lead_count >= 5 THEN
    v_score := v_score + 10;
  ELSIF v_lead_count >= 1 THEN
    v_score := v_score + 5;
  END IF;

  -- Response time (5 pts)
  SELECT AVG(EXTRACT(EPOCH FROM (cm2.created_at - cm1.created_at))/60)
    INTO v_avg_response
    FROM chat_messages cm1
    JOIN chat_messages cm2 ON cm2.conversation_id = cm1.conversation_id
   WHERE cm1.sender_id <> _user_id AND cm2.sender_id = _user_id
     AND cm2.created_at > cm1.created_at
     AND cm1.created_at > now() - interval '30 days';

  IF v_avg_response IS NOT NULL AND v_avg_response < 30 THEN
    v_score := v_score + 5;
  ELSIF v_avg_response IS NOT NULL AND v_avg_response < 120 THEN
    v_score := v_score + 2;
    v_suggestions := v_suggestions || jsonb_build_object(
      'priority', 5, 'icon', 'Zap',
      'text', 'Responda mais rápido. Profissionais que respondem em <30min ganham o badge "Resposta Rápida".',
      'action', '/dashboard/chat');
  END IF;

  -- Cap at 100
  v_score := LEAST(v_score, 100);

  -- Sort suggestions by priority and limit to 4
  v_suggestions := (
    SELECT COALESCE(jsonb_agg(s ORDER BY (s->>'priority')::int), '[]'::jsonb)
      FROM (SELECT s FROM jsonb_array_elements(v_suggestions) s LIMIT 4) sub
  );

  RETURN jsonb_build_object(
    'score', v_score,
    'suggestions', v_suggestions,
    'breakdown', jsonb_build_object(
      'reviews', v_review_count,
      'leads', v_lead_count,
      'avg_response_min', ROUND(COALESCE(v_avg_response, 0)::numeric, 1)
    )
  );
END;
$$;

-- 6. RPC: Resumo Semanal
CREATE OR REPLACE FUNCTION public.get_weekly_summary(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider RECORD;
  v_views INT := 0;
  v_wpp_clicks INT := 0;
  v_leads INT := 0;
  v_top_leads INT := 0;
  v_top_name TEXT;
  v_curr_rank INT;
  v_prev_rank INT;
  v_rank_change INT := 0;
BEGIN
  SELECT id, city, state, view_count INTO v_provider
    FROM providers WHERE user_id = _user_id AND deleted_at IS NULL;
  IF v_provider.id IS NULL THEN
    RETURN jsonb_build_object('available', false);
  END IF;

  -- Leads this week
  SELECT COUNT(*) INTO v_leads FROM leads
    WHERE provider_id = v_provider.id AND created_at > now() - interval '7 days';

  -- Whatsapp clicks
  SELECT COUNT(*) INTO v_wpp_clicks FROM contact_clicks
    WHERE provider_id = v_provider.id
      AND contact_type = 'whatsapp'
      AND created_at > now() - interval '7 days';

  -- Approx views (weekly view delta - using current view_count as proxy)
  v_views := COALESCE(v_provider.view_count, 0);

  -- Top performer in same city
  SELECT lead_count, business_name INTO v_top_leads, v_top_name
  FROM (
    SELECT p.business_name, COUNT(l.id) AS lead_count
    FROM providers p
    LEFT JOIN leads l ON l.provider_id = p.id AND l.created_at > now() - interval '7 days'
    WHERE LOWER(p.city) = LOWER(v_provider.city) AND p.deleted_at IS NULL
    GROUP BY p.id, p.business_name
    ORDER BY lead_count DESC
    LIMIT 1
  ) t;

  -- Ranking change (current week vs previous week by leads in city)
  SELECT pos INTO v_curr_rank FROM (
    SELECT p.id, ROW_NUMBER() OVER (ORDER BY COUNT(l.id) DESC, p.created_at ASC) AS pos
    FROM providers p
    LEFT JOIN leads l ON l.provider_id = p.id AND l.created_at > now() - interval '7 days'
    WHERE LOWER(p.city) = LOWER(v_provider.city) AND p.deleted_at IS NULL
    GROUP BY p.id
  ) r WHERE r.id = v_provider.id;

  SELECT pos INTO v_prev_rank FROM (
    SELECT p.id, ROW_NUMBER() OVER (ORDER BY COUNT(l.id) DESC, p.created_at ASC) AS pos
    FROM providers p
    LEFT JOIN leads l ON l.provider_id = p.id
      AND l.created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days'
    WHERE LOWER(p.city) = LOWER(v_provider.city) AND p.deleted_at IS NULL
    GROUP BY p.id
  ) r WHERE r.id = v_provider.id;

  v_rank_change := COALESCE(v_prev_rank, v_curr_rank) - COALESCE(v_curr_rank, 0);

  RETURN jsonb_build_object(
    'available', true,
    'views', v_views,
    'whatsapp_clicks', v_wpp_clicks,
    'leads', v_leads,
    'rank_current', v_curr_rank,
    'rank_change', v_rank_change,
    'top_competitor_leads', COALESCE(v_top_leads, 0),
    'top_competitor_name', v_top_name,
    'city', v_provider.city
  );
END;
$$;
