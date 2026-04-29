
-- 1) Configuração de janela anti-duplicidade (em minutos)
INSERT INTO public.site_settings (key, value)
VALUES ('integrity_alert_window_minutes', '60'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) Índices para acelerar filtros (admin/integridade e admin/notificações)
CREATE INDEX IF NOT EXISTS idx_integrity_reports_scope_ranat
  ON public.integrity_reports (scope, ran_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_link
  ON public.notifications (link)
  WHERE link IS NOT NULL;

-- 3) Atualiza run_integrity_check com janela anti-duplicidade.
--    Assinatura do alerta = JSON ordenado dos contadores críticos.
CREATE OR REPLACE FUNCTION public.run_integrity_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_providers_no_services INT;
  v_services_no_category INT;
  v_providers_null_city INT;
  v_providers_null_neighborhood INT;
  v_services_null_name INT;
  v_total INT;
  v_critical INT;
  v_details JSONB;
  v_signature JSONB;
  v_report_id UUID;
  v_admin RECORD;
  v_msg TEXT;
  v_window_min INT;
  v_dup_count INT;
BEGIN
  SELECT COUNT(*) INTO v_providers_no_services
  FROM public.providers p
  WHERE NOT EXISTS (SELECT 1 FROM public.services s WHERE s.provider_id = p.id);

  SELECT COUNT(*) INTO v_services_no_category
  FROM public.services WHERE category_id IS NULL;

  SELECT COUNT(*) INTO v_providers_null_city
  FROM public.providers WHERE city IS NULL OR btrim(city) = '';

  SELECT COUNT(*) INTO v_providers_null_neighborhood
  FROM public.providers WHERE neighborhood IS NULL OR btrim(neighborhood) = '';

  SELECT COUNT(*) INTO v_services_null_name
  FROM public.services WHERE service_name IS NULL OR btrim(service_name) = '';

  v_total := v_providers_no_services + v_services_no_category +
             v_providers_null_city + v_providers_null_neighborhood +
             v_services_null_name;

  v_critical := v_services_no_category + v_services_null_name + v_providers_null_city;

  v_details := jsonb_build_object(
    'providers_without_services', v_providers_no_services,
    'services_without_category', v_services_no_category,
    'providers_null_city', v_providers_null_city,
    'providers_null_neighborhood', v_providers_null_neighborhood,
    'services_null_name', v_services_null_name,
    'critical_count', v_critical
  );

  -- Sempre registra a rodada diária
  INSERT INTO public.integrity_reports (scope, finding_count, details)
  VALUES ('daily', v_total, v_details)
  RETURNING id INTO v_report_id;

  IF v_critical > 0 THEN
    -- Janela anti-duplicidade
    SELECT COALESCE((value)::int, 60) INTO v_window_min
    FROM public.site_settings WHERE key = 'integrity_alert_window_minutes';
    v_window_min := COALESCE(v_window_min, 60);

    -- Assinatura: contadores críticos. Se for IDÊNTICA a um alerta dentro da janela,
    -- não dispara nova notificação nem nova linha critical_alert.
    v_signature := jsonb_build_object(
      'services_without_category', v_services_no_category,
      'services_null_name',        v_services_null_name,
      'providers_null_city',       v_providers_null_city
    );

    SELECT COUNT(*) INTO v_dup_count
    FROM public.integrity_reports
    WHERE scope = 'critical_alert'
      AND ran_at >= now() - make_interval(mins => v_window_min)
      AND (details->'signature') = v_signature;

    IF v_dup_count = 0 THEN
      INSERT INTO public.integrity_reports (scope, finding_count, details)
      VALUES (
        'critical_alert',
        v_critical,
        v_details || jsonb_build_object(
          'parent_report_id', v_report_id,
          'signature', v_signature,
          'window_minutes', v_window_min
        )
      );

      v_msg := format(
        'Integridade: %s achado(s) crítico(s) — categorias=%s, nomes=%s, cidade=%s.',
        v_critical, v_services_no_category, v_services_null_name, v_providers_null_city
      );

      FOR v_admin IN
        SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
      LOOP
        BEGIN
          INSERT INTO public.notifications (user_id, title, message, type, link)
          VALUES (
            v_admin.user_id,
            'Alerta de integridade',
            v_msg,
            'system',
            '/admin/integridade'
          );
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END LOOP;
    ELSE
      -- Marca no relatório diário que houve dedup, para auditoria.
      UPDATE public.integrity_reports
      SET details = details || jsonb_build_object('deduplicated', true, 'window_minutes', v_window_min)
      WHERE id = v_report_id;
    END IF;
  END IF;

  RETURN v_details;
END;
$function$;

-- 4) Marcar notificação como lida (próprio usuário) — com SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.mark_notification_read(_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.notifications
  SET read = true
  WHERE id = _notification_id AND user_id = v_uid;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

-- 5) Marcar várias como lidas
CREATE OR REPLACE FUNCTION public.mark_notifications_read_bulk(_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_uid IS NULL OR _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.notifications
  SET read = true
  WHERE user_id = v_uid AND id = ANY(_ids);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read_bulk(uuid[]) TO authenticated;

-- 6) Contador de não-lidas (utilitário)
CREATE OR REPLACE FUNCTION public.count_unread_notifications()
RETURNS int
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.notifications
  WHERE user_id = auth.uid() AND read = false;
$$;

GRANT EXECUTE ON FUNCTION public.count_unread_notifications() TO authenticated;
