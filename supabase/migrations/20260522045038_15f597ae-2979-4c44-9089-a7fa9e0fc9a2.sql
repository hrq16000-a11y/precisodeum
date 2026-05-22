-- ════════════════════════════════════════════════════════════════
-- FASE 1.6 — Sponsor Scope Consistency Audit (read-only first)
-- ════════════════════════════════════════════════════════════════

-- ─── audit_sponsor_scope_consistency() — diagnóstico read-only ───
CREATE OR REPLACE FUNCTION public.audit_sponsor_scope_consistency()
RETURNS TABLE (
  sponsor_id uuid,
  sponsor_name text,
  sponsor_type text,
  linked_city text,
  linked_city_slug text,
  suggested_city text,
  suggested_city_slug text,
  linked_category text,
  linked_category_slug text,
  suggested_category text,
  suggested_category_slug text,
  issue_type text,
  confidence text,
  auto_fixable boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      COALESCE(NULLIF(s.title, ''), s.company_name, '(sem nome)') AS sname,
      s.sponsor_type,
      s.linked_city,
      s.linked_city_slug,
      s.linked_category,
      s.linked_category_slug
    FROM sponsors s
    WHERE s.deleted_at IS NULL
  ),
  city_match AS (
    SELECT
      b.id,
      c.name AS canonical_city,
      public.normalize_slug(c.name) AS canonical_city_slug
    FROM base b
    LEFT JOIN LATERAL (
      SELECT name
      FROM cities
      WHERE public.normalize_slug(name) = public.normalize_slug(COALESCE(b.linked_city, ''))
      LIMIT 1
    ) c ON true
    WHERE COALESCE(b.linked_city, '') <> ''
  ),
  cat_match AS (
    SELECT
      b.id,
      cat.name AS canonical_cat,
      cat.slug AS canonical_cat_slug
    FROM base b
    LEFT JOIN LATERAL (
      SELECT name, slug
      FROM categories
      WHERE deleted_at IS NULL
        AND (
          slug = COALESCE(b.linked_category_slug, public.normalize_slug(b.linked_category))
          OR public.normalize_slug(name) = public.normalize_slug(COALESCE(b.linked_category, ''))
        )
      LIMIT 1
    ) cat ON true
    WHERE COALESCE(b.linked_category, '') <> ''
  )
  SELECT
    b.id,
    b.sname,
    b.sponsor_type,
    b.linked_city,
    b.linked_city_slug,
    cm.canonical_city,
    cm.canonical_city_slug,
    b.linked_category,
    b.linked_category_slug,
    cam.canonical_cat,
    cam.canonical_cat_slug,
    CASE
      WHEN b.sponsor_type = 'city' AND COALESCE(b.linked_city, '') = '' THEN 'missing_city'
      WHEN b.sponsor_type = 'category' AND COALESCE(b.linked_category, '') = '' THEN 'missing_category'
      WHEN b.sponsor_type = 'city' AND cm.canonical_city IS NULL THEN 'city_not_in_catalog'
      WHEN b.sponsor_type = 'city' AND cm.canonical_city_slug IS DISTINCT FROM COALESCE(b.linked_city_slug, '') THEN 'city_slug_mismatch'
      WHEN b.sponsor_type = 'city' AND cm.canonical_city IS DISTINCT FROM b.linked_city THEN 'city_label_differs'
      WHEN b.sponsor_type = 'category' AND cam.canonical_cat IS NULL THEN 'category_not_in_catalog'
      WHEN b.sponsor_type = 'category' AND cam.canonical_cat_slug IS DISTINCT FROM COALESCE(b.linked_category_slug, '') THEN 'category_slug_mismatch'
      ELSE 'ok'
    END AS issue_type,
    CASE
      WHEN b.sponsor_type = 'city' AND cm.canonical_city_slug IS NOT NULL
           AND cm.canonical_city_slug = public.normalize_slug(COALESCE(b.linked_city, '')) THEN 'high'
      WHEN b.sponsor_type = 'category' AND cam.canonical_cat_slug IS NOT NULL
           AND cam.canonical_cat_slug = public.normalize_slug(COALESCE(b.linked_category, '')) THEN 'high'
      WHEN cm.canonical_city IS NOT NULL OR cam.canonical_cat IS NOT NULL THEN 'medium'
      ELSE 'low'
    END AS confidence,
    -- auto_fixable: canonical encontrado E slug normalizado coincide (somente label/slug atrás do canônico)
    CASE
      WHEN b.sponsor_type = 'city'
           AND cm.canonical_city IS NOT NULL
           AND cm.canonical_city_slug = public.normalize_slug(COALESCE(b.linked_city, ''))
           AND (cm.canonical_city IS DISTINCT FROM b.linked_city
                OR cm.canonical_city_slug IS DISTINCT FROM COALESCE(b.linked_city_slug, ''))
        THEN true
      WHEN b.sponsor_type = 'category'
           AND cam.canonical_cat IS NOT NULL
           AND cam.canonical_cat_slug = public.normalize_slug(COALESCE(b.linked_category, ''))
           AND (cam.canonical_cat_slug IS DISTINCT FROM COALESCE(b.linked_category_slug, ''))
        THEN true
      ELSE false
    END AS auto_fixable
  FROM base b
  LEFT JOIN city_match cm ON cm.id = b.id
  LEFT JOIN cat_match cam ON cam.id = b.id
  ORDER BY
    CASE
      WHEN b.sponsor_type IN ('city','category') THEN 0
      ELSE 1
    END,
    b.sname;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_sponsor_scope_consistency() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_sponsor_scope_consistency() TO authenticated;

-- ─── apply_sponsor_scope_fix — correção individual com audit ───
CREATE OR REPLACE FUNCTION public.apply_sponsor_scope_fix(
  _sponsor_id uuid,
  _new_city text DEFAULT NULL,
  _new_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT jsonb_build_object(
    'linked_city', linked_city,
    'linked_city_slug', linked_city_slug,
    'linked_category', linked_category,
    'linked_category_slug', linked_category_slug
  )
  INTO v_before
  FROM sponsors WHERE id = _sponsor_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'sponsor_not_found';
  END IF;

  UPDATE sponsors
  SET
    linked_city = COALESCE(_new_city, linked_city),
    linked_category = COALESCE(_new_category, linked_category),
    updated_at = now()
  WHERE id = _sponsor_id;
  -- slugs sincronizados pelo trigger trg_sync_sponsor_normalized_slugs (Fase 1.4)

  SELECT jsonb_build_object(
    'linked_city', linked_city,
    'linked_city_slug', linked_city_slug,
    'linked_category', linked_category,
    'linked_category_slug', linked_category_slug
  )
  INTO v_after
  FROM sponsors WHERE id = _sponsor_id;

  -- Audit log explícito (best-effort)
  BEGIN
    INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'update',
      'sponsor_scope_fix',
      _sponsor_id::text,
      jsonb_build_object('before', v_before, 'after', v_after)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'before', v_before, 'after', v_after);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_sponsor_scope_fix(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_sponsor_scope_fix(uuid, text, text) TO authenticated;