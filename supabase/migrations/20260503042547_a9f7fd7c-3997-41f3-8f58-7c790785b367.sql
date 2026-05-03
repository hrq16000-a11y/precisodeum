
-- ============================================================
-- Round 3 · Hardening: SECURITY DEFINER + PII columns + Index
-- ============================================================

-- 1) admin_adjust_points: bloquear privilege escalation
CREATE OR REPLACE FUNCTION public.admin_adjust_points(target_user_id uuid, point_delta integer, reset_to_zero boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_pts integer;
BEGIN
  -- Guard: somente admins podem ajustar pontos de qualquer usuário.
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem ajustar pontos';
  END IF;

  IF reset_to_zero THEN
    UPDATE profiles SET engagement_points = 0 WHERE id = target_user_id;
    RETURN 0;
  END IF;

  UPDATE profiles
  SET engagement_points = GREATEST(0, engagement_points + point_delta)
  WHERE id = target_user_id
  RETURNING engagement_points INTO new_pts;

  RETURN COALESCE(new_pts, 0);
END;
$function$;

-- 2) mark_ghost_providers: exigir admin
CREATE OR REPLACE FUNCTION public.mark_ghost_providers()
 RETURNS TABLE(marked_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Guard: somente admins podem arquivar prestadores em massa.
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar mark_ghost_providers';
  END IF;

  WITH updated AS (
    UPDATE public.providers
    SET status = 'archived', updated_at = now()
    WHERE status = 'pending'
      AND created_at < now() - interval '60 days'
      AND (business_name IS NULL OR TRIM(business_name) = '')
      AND category_id IS NULL
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_count FROM updated;
  RETURN QUERY SELECT v_count;
END;
$function$;

-- 3) PII column-level revokes em providers
-- Observação: tax_id NÃO existe em providers (apenas em profiles), então só revogamos cnpj e cpf.
-- Defesa em profundidade: além das RLS, removemos privilégio de coluna via PostgREST.
REVOKE SELECT (cnpj, cpf) ON public.providers FROM anon;
REVOKE SELECT (cnpj, cpf) ON public.providers FROM authenticated;

-- 4) Índice composto para busca categoria+cidade
CREATE INDEX IF NOT EXISTS idx_providers_category_city_active
  ON public.providers (category_id, lower(city))
  WHERE status = 'approved' AND deleted_at IS NULL;
