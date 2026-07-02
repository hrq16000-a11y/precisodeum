-- Security hardening (2026-06-01):
--   1) jobs/services: mascarar WhatsApp/telefone/contato para visitantes anônimos.
--   2) services: incluir `deleted_at IS NULL` na política pública.
--   3) open_leads: RPC SECURITY DEFINER que só revela o WhatsApp do cliente
--      depois que o prestador aceitou o convite (status = 'accepted').
--
-- O Data API (PostgREST) respeita REVOKE de coluna por role. Mantemos SELECT
-- pleno para `authenticated` (e admins via RLS); apenas `anon` perde acesso
-- às colunas de contato.

-- ───────────────── 1. jobs ─────────────────
REVOKE SELECT (whatsapp, contact_phone, contact_name) ON public.jobs FROM anon;

-- ───────────────── 2. services ─────────────────
-- 2a) Atualiza política pública para excluir registros soft-deleted.
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
CREATE POLICY "Services are viewable by everyone"
  ON public.services
  FOR SELECT
  USING (deleted_at IS NULL);

-- 2b) Mascarar WhatsApp do prestador para visitantes anônimos.
REVOKE SELECT (whatsapp) ON public.services FROM anon;

-- ───────────────── 3. open_leads ─────────────────
-- RPC que devolve o contato do cliente APENAS quando o prestador chamador
-- teve a sua resposta aceita ('accepted'). Qualquer outro caso → NULLs.
CREATE OR REPLACE FUNCTION public.get_open_lead_client_contact(_response_id uuid)
RETURNS TABLE (client_name text, client_whatsapp text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
  v_status  text;
  v_caller  uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  SELECT olr.open_lead_id, olr.status
    INTO v_lead_id, v_status
    FROM public.open_lead_responses olr
   WHERE olr.id = _response_id
     AND olr.provider_user_id = v_caller
   LIMIT 1;

  IF v_lead_id IS NULL OR v_status IS DISTINCT FROM 'accepted' THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT ol.client_name, ol.client_whatsapp
      FROM public.open_leads ol
     WHERE ol.id = v_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_open_lead_client_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_open_lead_client_contact(uuid) TO authenticated;