CREATE OR REPLACE FUNCTION public.register_daily_checkin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  -- Timezone fixo: imune ao TZ do servidor e ao TZ do dispositivo do usuário
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_yesterday date := v_today - 1;
  v_last_checkin record;
  v_new_streak int := 1;
  v_inserted boolean := false;
  v_seven_done boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Calcula streak ANTES de tentar inserir (pode descartar se já existe)
  SELECT * INTO v_last_checkin
  FROM public.daily_checkins
  WHERE user_id = v_user_id
  ORDER BY checkin_date DESC
  LIMIT 1;

  IF v_last_checkin IS NOT NULL AND v_last_checkin.checkin_date = v_yesterday THEN
    v_new_streak := v_last_checkin.streak_count + 1;
  ELSIF v_last_checkin IS NOT NULL AND v_last_checkin.checkin_date = v_today THEN
    -- Já fez hoje — retorna idempotente sem tocar engagement_log
    RETURN jsonb_build_object(
      'already_done_today', true,
      'streak', v_last_checkin.streak_count,
      'date', v_today
    );
  ELSE
    v_new_streak := 1;
  END IF;

  -- INSERT atômico: a UNIQUE constraint (user_id, checkin_date) blinda race conditions
  INSERT INTO public.daily_checkins (user_id, checkin_date, streak_count)
  VALUES (v_user_id, v_today, v_new_streak)
  ON CONFLICT (user_id, checkin_date) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Se outro request paralelo inseriu primeiro, retorna idempotente
  IF NOT v_inserted THEN
    SELECT streak_count INTO v_new_streak
    FROM public.daily_checkins
    WHERE user_id = v_user_id AND checkin_date = v_today;
    RETURN jsonb_build_object(
      'already_done_today', true,
      'streak', v_new_streak,
      'date', v_today
    );
  END IF;

  -- Crédito de pontos só ocorre quando a inserção foi nova
  PERFORM public.award_engagement_points(v_user_id, 'daily_checkin',
    jsonb_build_object('streak', v_new_streak, 'date', v_today));

  IF v_new_streak >= 7 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.engagement_log
      WHERE user_id = v_user_id AND action_key = 'onboarding_checkin_7days'
    ) INTO v_seven_done;
    IF NOT v_seven_done THEN
      PERFORM public.award_engagement_points(v_user_id, 'onboarding_checkin_7days',
        jsonb_build_object('streak', v_new_streak));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'already_done_today', false,
    'streak', v_new_streak,
    'milestone_7d', v_new_streak = 7,
    'date', v_today
  );
END;
$function$;