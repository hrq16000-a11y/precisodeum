CREATE OR REPLACE FUNCTION public.check_upsell_on_lead_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Fixed: use direct column instead of value->>'max_leads'
  SELECT tr.max_leads INTO v_max_leads
  FROM tier_rules tr
  WHERE tr.tier_key = COALESCE(v_tier_key, 'free')
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
$function$;