CREATE TABLE IF NOT EXISTS public.whatsapp_clicks_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  clicked_on_utc date GENERATED ALWAYS AS ((clicked_at AT TIME ZONE 'UTC')::date) STORED
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_user_clicked_at
  ON public.whatsapp_clicks_log (user_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_provider
  ON public.whatsapp_clicks_log (provider_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsapp_clicks_user_provider_day
  ON public.whatsapp_clicks_log (user_id, provider_id, clicked_on_utc);

CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_user_day
  ON public.whatsapp_clicks_log (user_id, clicked_on_utc);

ALTER TABLE public.whatsapp_clicks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_whatsapp_clicks"
  ON public.whatsapp_clicks_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins_select_all_whatsapp_clicks"
  ON public.whatsapp_clicks_log
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users_insert_own_whatsapp_clicks"
  ON public.whatsapp_clicks_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_and_log_whatsapp_click(p_provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit int := 3;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_count int;
  v_already_today boolean;
  v_provider_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_provider_id IS NULL THEN
    RAISE EXCEPTION 'provider_id obrigatorio' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.providers WHERE id = p_provider_id)
    INTO v_provider_exists;
  IF NOT v_provider_exists THEN
    RAISE EXCEPTION 'Prestador nao encontrado' USING ERRCODE = '23503';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.whatsapp_clicks_log
    WHERE user_id = v_user_id
      AND provider_id = p_provider_id
      AND clicked_on_utc = v_today
  ) INTO v_already_today;

  SELECT count(*)
    INTO v_count
    FROM public.whatsapp_clicks_log
   WHERE user_id = v_user_id
     AND clicked_on_utc = v_today;

  IF v_already_today THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reused', true,
      'used_today', v_count,
      'remaining_today', GREATEST(v_limit - v_count, 0),
      'daily_limit', v_limit
    );
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite diario de % contatos atingido. Volte amanha ou consulte Meus Contatos no painel.', v_limit
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.whatsapp_clicks_log (user_id, provider_id)
  VALUES (v_user_id, p_provider_id);

  RETURN jsonb_build_object(
    'status', 'ok',
    'reused', false,
    'used_today', v_count + 1,
    'remaining_today', GREATEST(v_limit - (v_count + 1), 0),
    'daily_limit', v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_log_whatsapp_click(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_and_log_whatsapp_click(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_whatsapp_clicks_today()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit int := 3;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('used_today', 0, 'remaining_today', v_limit, 'daily_limit', v_limit);
  END IF;

  SELECT count(*)
    INTO v_count
    FROM public.whatsapp_clicks_log
   WHERE user_id = v_user_id
     AND clicked_on_utc = v_today;

  RETURN jsonb_build_object(
    'used_today', v_count,
    'remaining_today', GREATEST(v_limit - v_count, 0),
    'daily_limit', v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_clicks_today() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_clicks_today() TO authenticated;