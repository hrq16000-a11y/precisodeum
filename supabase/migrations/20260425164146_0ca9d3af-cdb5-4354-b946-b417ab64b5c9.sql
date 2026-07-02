-- Função que normaliza lead_context garantindo campos obrigatórios
CREATE OR REPLACE FUNCTION public.ensure_lead_context_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := COALESCE(NEW.lead_context, '{}'::jsonb);

  -- Campos obrigatórios com fallback seguro
  IF NOT (ctx ? 'origin') OR ctx->>'origin' IS NULL OR ctx->>'origin' = '' THEN
    ctx := ctx || jsonb_build_object('origin', 'unknown');
  END IF;

  IF NOT (ctx ? 'page') OR ctx->>'page' IS NULL OR ctx->>'page' = '' THEN
    ctx := ctx || jsonb_build_object('page', 'unknown');
  END IF;

  IF NOT (ctx ? 'city') THEN
    ctx := ctx || jsonb_build_object('city', NULL);
  END IF;

  IF NOT (ctx ? 'state') THEN
    ctx := ctx || jsonb_build_object('state', NULL);
  END IF;

  IF NOT (ctx ? 'category') THEN
    ctx := ctx || jsonb_build_object('category', NULL);
  END IF;

  IF NOT (ctx ? 'captured_at') OR ctx->>'captured_at' IS NULL THEN
    ctx := ctx || jsonb_build_object('captured_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  END IF;

  NEW.lead_context := ctx;
  RETURN NEW;
END;
$$;

-- Trigger antes do INSERT em leads
DROP TRIGGER IF EXISTS trg_ensure_lead_context_fields ON public.leads;
CREATE TRIGGER trg_ensure_lead_context_fields
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_lead_context_fields();