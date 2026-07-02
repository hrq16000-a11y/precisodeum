CREATE OR REPLACE FUNCTION public.check_upsell_on_service_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Get max_services directly from tier_rules column
  SELECT tr.max_services INTO v_max_services
  FROM tier_rules tr
  WHERE tr.tier_key = COALESCE(v_tier_key, 'free')
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
$function$;