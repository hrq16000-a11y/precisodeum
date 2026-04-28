CREATE OR REPLACE FUNCTION public.resolve_city_slug(_input text)
RETURNS TABLE(slug text, name text, state text, state_uf text, matched_exact boolean)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_input text := lower(trim(coalesce(_input, '')));
  v_norm  text;
BEGIN
  IF v_input = '' THEN
    RETURN;
  END IF;

  -- 1) Match exato
  RETURN QUERY
  SELECT c.slug, c.name, c.state, c.state_uf, true
  FROM public.cities c
  WHERE c.slug = v_input
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 2) Slug é "<input>-<uf>" (ex.: picarras + slug terminando em -sc)
  RETURN QUERY
  SELECT c.slug, c.name, c.state, c.state_uf, false
  FROM public.cities c
  WHERE c.slug ~ ('(^|-)' || v_input || '(-[a-z]{2})?$')
  ORDER BY c.has_providers DESC, c.provider_count DESC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 3) Slug contém o termo como token
  RETURN QUERY
  SELECT c.slug, c.name, c.state, c.state_uf, false
  FROM public.cities c
  WHERE c.slug ILIKE ('%' || v_input || '%')
  ORDER BY c.has_providers DESC, c.provider_count DESC, length(c.slug) ASC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 4) Match por nome normalizado (sem acento, lower, espaços→hífen)
  v_norm := translate(
    lower(v_input),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );

  RETURN QUERY
  SELECT c.slug, c.name, c.state, c.state_uf, false
  FROM public.cities c
  WHERE translate(
          lower(replace(c.name, ' ', '-')),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'aaaaaeeeeiiiiooooouuuucn'
        ) ILIKE ('%' || v_norm || '%')
  ORDER BY c.has_providers DESC, c.provider_count DESC, length(c.name) ASC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_city_slug(text) TO anon, authenticated;