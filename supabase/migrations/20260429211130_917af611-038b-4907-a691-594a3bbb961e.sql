
-- Atualiza run_integrity_check para emitir alertas quando há achados críticos:
--   - Insere uma linha separada (scope='critical_alert') no integrity_reports
--   - Notifica todos os admins (notifications) com link para /admin/integridade
-- Mantém compatibilidade: ainda insere a linha 'daily' como antes.

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
  v_report_id UUID;
  v_admin RECORD;
  v_msg TEXT;
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

  -- Achados críticos: services sem categoria/sem nome ou providers sem cidade
  -- são bloqueadores de busca/ranking, então classificamos como críticos.
  v_critical := v_services_no_category + v_services_null_name + v_providers_null_city;

  v_details := jsonb_build_object(
    'providers_without_services', v_providers_no_services,
    'services_without_category', v_services_no_category,
    'providers_null_city', v_providers_null_city,
    'providers_null_neighborhood', v_providers_null_neighborhood,
    'services_null_name', v_services_null_name,
    'critical_count', v_critical
  );

  INSERT INTO public.integrity_reports (scope, finding_count, details)
  VALUES ('daily', v_total, v_details)
  RETURNING id INTO v_report_id;

  -- Quando há achados críticos: registra linha separada e notifica admins.
  IF v_critical > 0 THEN
    INSERT INTO public.integrity_reports (scope, finding_count, details)
    VALUES (
      'critical_alert',
      v_critical,
      v_details || jsonb_build_object('parent_report_id', v_report_id)
    );

    v_msg := format(
      'Integridade: %s achado(s) crítico(s) — categorias=%s, nomes=%s, cidade=%s.',
      v_critical, v_services_no_category, v_services_null_name, v_providers_null_city
    );

    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
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
        -- Best-effort: nunca derruba a rotina diária por falha de notificação.
        NULL;
      END;
    END LOOP;
  END IF;

  RETURN v_details;
END;
$function$;
