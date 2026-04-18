CREATE OR REPLACE FUNCTION public.admin_system_health_full()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_signup jsonb;
  v_storage jsonb;
  v_search jsonb;
  v_rls jsonb;
  v_errors jsonb;
  v_trigger_ms numeric;
  v_search_ms numeric;
  v_t0 timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  -- A) Signup health (last 24h)
  v_t0 := clock_timestamp();
  PERFORM 1 FROM profiles WHERE user_ref IS NOT NULL LIMIT 1;
  v_trigger_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_t0)) * 1000;

  SELECT jsonb_build_object(
    'last_24h', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '24 hours'),
    'last_7d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days'),
    'total', (SELECT COUNT(*) FROM profiles),
    'missing_ref', (SELECT COUNT(*) FROM profiles WHERE user_ref IS NULL),
    'suspicious', (SELECT COUNT(*) FROM profiles WHERE is_suspicious = true),
    'trigger_latency_ms', ROUND(v_trigger_ms::numeric, 2)
  ) INTO v_signup;

  -- B) Storage / Portfolio integrity
  SELECT jsonb_build_object(
    'total_albums', (SELECT COUNT(*) FROM portfolio_albums),
    'total_photos', (SELECT COUNT(*) FROM portfolio_photos),
    'total_media', (SELECT COUNT(*) FROM media WHERE is_active = true),
    'orphan_albums', (SELECT COUNT(*) FROM portfolio_albums pa WHERE NOT EXISTS (SELECT 1 FROM providers p WHERE p.id = pa.provider_id)),
    'orphan_photos', (SELECT COUNT(*) FROM portfolio_photos pp WHERE NOT EXISTS (SELECT 1 FROM portfolio_albums pa WHERE pa.id = pp.album_id)),
    'orphan_media', (SELECT COUNT(*) FROM media m WHERE m.is_active = true AND m.user_ref NOT IN ('unlinked','sponsors','settings') AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_ref = m.user_ref)),
    'missing_user_ref_photos', (SELECT COUNT(*) FROM portfolio_photos WHERE user_ref IS NULL)
  ) INTO v_storage;

  -- C) Search performance probe
  v_t0 := clock_timestamp();
  PERFORM 1 FROM providers WHERE status='approved' AND deleted_at IS NULL AND (LOWER(COALESCE(business_name,'')) LIKE '%a%') LIMIT 50;
  v_search_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_t0)) * 1000;

  SELECT jsonb_build_object(
    'search_latency_ms', ROUND(v_search_ms::numeric, 2),
    'approved_providers', (SELECT COUNT(*) FROM providers WHERE status='approved' AND deleted_at IS NULL),
    'pending_providers', (SELECT COUNT(*) FROM providers WHERE status='pending' AND deleted_at IS NULL),
    'indexed_geo', (SELECT COUNT(*) FROM providers WHERE status='approved' AND deleted_at IS NULL AND geog IS NOT NULL)
  ) INTO v_search;

  -- D) RLS coverage
  SELECT jsonb_build_object(
    'tables_total', (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'),
    'tables_with_rls', (SELECT COUNT(*) FROM pg_tables t WHERE t.schemaname='public' AND EXISTS (SELECT 1 FROM pg_class c WHERE c.relname=t.tablename AND c.relrowsecurity=true)),
    'policies_total', (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public')
  ) INTO v_rls;

  -- E) Silent error log (last 24h)
  SELECT jsonb_build_object(
    'unresolved_24h', (SELECT COUNT(*) FROM error_reports WHERE created_at > now() - interval '24 hours' AND resolved = false),
    'critical_24h', (SELECT COUNT(*) FROM error_reports WHERE created_at > now() - interval '24 hours' AND severity = 'critical'),
    'recent', (SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
      SELECT id, error_message, component_name, page_path, severity, created_at, resolved
      FROM error_reports
      WHERE created_at > now() - interval '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    ) x)
  ) INTO v_errors;

  RETURN jsonb_build_object(
    'signup', v_signup,
    'storage', v_storage,
    'search', v_search,
    'rls', v_rls,
    'errors', v_errors,
    'generated_at', now()
  );
END;
$$;