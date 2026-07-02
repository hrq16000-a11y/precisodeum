CREATE OR REPLACE FUNCTION public.derive_provider_primary_category(_provider_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sc.category_id
  FROM public.services s
  JOIN public.service_categories sc ON sc.service_id = s.id
  JOIN public.categories c ON c.id = sc.category_id
  WHERE s.provider_id = _provider_id
    AND c.deleted_at IS NULL
  ORDER BY s.created_at ASC NULLS LAST, s.id ASC
  LIMIT 1;
$$;

UPDATE public.providers p
SET category_id = public.derive_provider_primary_category(p.id)
WHERE p.category_id IS NULL
  AND p.deleted_at IS NULL
  AND public.derive_provider_primary_category(p.id) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.auto_set_provider_primary_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_current_cat uuid;
  v_derived_cat uuid;
BEGIN
  SELECT s.provider_id INTO v_provider_id
  FROM public.services s
  WHERE s.id = NEW.service_id;

  IF v_provider_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT category_id INTO v_current_cat
  FROM public.providers
  WHERE id = v_provider_id;

  IF v_current_cat IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_derived_cat := public.derive_provider_primary_category(v_provider_id);

  IF v_derived_cat IS NOT NULL THEN
    UPDATE public.providers
    SET category_id = v_derived_cat
    WHERE id = v_provider_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_provider_primary_category ON public.service_categories;
CREATE TRIGGER trg_auto_provider_primary_category
AFTER INSERT OR UPDATE ON public.service_categories
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_provider_primary_category();