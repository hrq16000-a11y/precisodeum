
-- Function to check plan limits and auto-create upsell notification
CREATE OR REPLACE FUNCTION public.check_upsell_on_service_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_user_ref text;
  v_tier_key text;
  v_max_services integer;
  v_current_count integer;
  v_pct numeric;
  v_title text;
  v_message text;
  v_already_notified boolean;
BEGIN
  -- Get provider owner
  SELECT p.user_id, pr.user_ref, at.tier_key
  INTO v_user_id, v_user_ref, v_tier_key
  FROM providers p
  JOIN profiles pr ON pr.id = p.user_id
  LEFT JOIN account_types at ON at.id = pr.account_type_id
  WHERE p.id = NEW.provider_id
    AND p.deleted_at IS NULL;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Only trigger for free/basic tiers
  IF v_tier_key IS NOT NULL AND v_tier_key NOT IN ('free', 'basic') THEN
    RETURN NEW;
  END IF;

  -- Get max_services from tier_rules
  SELECT (value->>'max_services')::integer INTO v_max_services
  FROM tier_rules
  WHERE tier_key = COALESCE(v_tier_key, 'free')
    AND active = true
  LIMIT 1;

  -- If unlimited or no rule found, skip
  IF v_max_services IS NULL OR v_max_services <= 0 OR v_max_services = -1 THEN
    RETURN NEW;
  END IF;

  -- Count current services
  SELECT COUNT(*) INTO v_current_count
  FROM services
  WHERE provider_id = NEW.provider_id
    AND deleted_at IS NULL;

  v_pct := (v_current_count::numeric / v_max_services::numeric) * 100;

  -- Only act at 80% or 100%
  IF v_pct < 80 THEN RETURN NEW; END IF;

  -- Check if we already notified in last 48h for same type
  SELECT EXISTS(
    SELECT 1 FROM notifications
    WHERE user_id = v_user_id
      AND type = 'upsell'
      AND created_at > now() - interval '48 hours'
  ) INTO v_already_notified;

  IF v_already_notified THEN RETURN NEW; END IF;

  -- Build notification
  IF v_pct >= 100 THEN
    v_title := '🚀 Você atingiu o limite do seu plano!';
    v_message := 'Você já tem ' || v_current_count || '/' || v_max_services || ' serviços cadastrados. Faça upgrade para desbloquear serviços ilimitados, destaque na busca e mais leads.';
  ELSE
    v_title := '⚡ Quase no limite do plano gratuito';
    v_message := 'Você está usando ' || v_current_count || ' de ' || v_max_services || ' serviços disponíveis. Considere fazer upgrade para não perder oportunidades.';
  END IF;

  -- Insert upsell notification
  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (v_user_id, v_title, v_message, 'upsell', '/dashboard/plano');

  RETURN NEW;
END;
$$;

-- Trigger on service insert/update
CREATE TRIGGER trg_upsell_on_service_change
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.check_upsell_on_service_change();

-- Also check leads limit
CREATE OR REPLACE FUNCTION public.check_upsell_on_lead_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_tier_key text;
  v_max_leads integer;
  v_current_count integer;
  v_pct numeric;
  v_title text;
  v_message text;
  v_already_notified boolean;
BEGIN
  -- Get provider owner
  SELECT p.user_id, at.tier_key
  INTO v_user_id, v_tier_key
  FROM providers p
  JOIN profiles pr ON pr.id = p.user_id
  LEFT JOIN account_types at ON at.id = pr.account_type_id
  WHERE p.id = NEW.provider_id
    AND p.deleted_at IS NULL;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF v_tier_key IS NOT NULL AND v_tier_key NOT IN ('free', 'basic') THEN
    RETURN NEW;
  END IF;

  SELECT (value->>'max_leads')::integer INTO v_max_leads
  FROM tier_rules
  WHERE tier_key = COALESCE(v_tier_key, 'free')
    AND active = true
  LIMIT 1;

  IF v_max_leads IS NULL OR v_max_leads <= 0 OR v_max_leads = -1 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM leads
  WHERE provider_id = NEW.provider_id;

  v_pct := (v_current_count::numeric / v_max_leads::numeric) * 100;

  IF v_pct < 80 THEN RETURN NEW; END IF;

  SELECT EXISTS(
    SELECT 1 FROM notifications
    WHERE user_id = v_user_id
      AND type = 'upsell'
      AND created_at > now() - interval '48 hours'
  ) INTO v_already_notified;

  IF v_already_notified THEN RETURN NEW; END IF;

  IF v_pct >= 100 THEN
    v_title := '📈 Limite de leads atingido!';
    v_message := 'Você recebeu ' || v_current_count || '/' || v_max_leads || ' leads. Com o upgrade, receba leads ilimitados e aumente suas conversões.';
  ELSE
    v_title := '📊 Seus leads estão quase no limite';
    v_message := 'Você já tem ' || v_current_count || ' de ' || v_max_leads || ' leads. Faça upgrade para não perder novos contatos.';
  END IF;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (v_user_id, v_title, v_message, 'upsell', '/dashboard/plano');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_upsell_on_lead_insert
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.check_upsell_on_lead_insert();
