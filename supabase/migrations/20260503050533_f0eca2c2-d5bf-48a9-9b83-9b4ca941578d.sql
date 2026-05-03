-- RPC: get_my_profile_status — retorna apenas booleano has_tax_id e full_name,
-- evitando trafegar o número real do CPF/CNPJ ao frontend.
CREATE OR REPLACE FUNCTION public.get_my_profile_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_has_tax_id boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT
    COALESCE(p.full_name, ''),
    (p.tax_id IS NOT NULL AND length(btrim(p.tax_id)) > 0)
    INTO v_full_name, v_has_tax_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'has_tax_id', COALESCE(v_has_tax_id, false),
    'full_name', v_full_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile_status() TO authenticated;