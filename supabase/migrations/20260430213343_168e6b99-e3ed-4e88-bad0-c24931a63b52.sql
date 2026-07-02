-- Índice único parcial para garantir dedupe de notificações de lead pelo link
-- (formato: /dashboard/leads/{lead_id}). Aplica-se apenas a type='lead' e link não-nulo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_user_lead_link
  ON public.notifications (user_id, link)
  WHERE type = 'lead' AND link IS NOT NULL;

-- Função: cria notification dedupada para o dono do provider quando um lead é INSERTed.
CREATE OR REPLACE FUNCTION public.notify_provider_on_new_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_in_app_enabled boolean := true;
  v_channels jsonb;
  v_title text;
  v_message text;
  v_link text;
  v_city text;
  v_uf text;
  v_origin text;
BEGIN
  -- Resolve dono do provider e suas preferências de canal in-app
  SELECT user_id, COALESCE(notification_channels, '{}'::jsonb)
    INTO v_user_id, v_channels
  FROM public.providers
  WHERE id = NEW.provider_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Respeita opt-out de in-app (default = true se a chave não existir)
  IF v_channels ? 'in_app' AND (v_channels->>'in_app')::boolean = false THEN
    RETURN NEW;
  END IF;

  v_city := COALESCE(NEW.lead_context->>'city', '');
  v_uf   := UPPER(COALESCE(NEW.lead_context->>'state', ''));
  v_origin := CASE
    WHEN v_city <> '' AND v_uf <> '' THEN v_city || ' • ' || v_uf
    WHEN v_city <> '' THEN v_city
    ELSE 'Origem desconhecida'
  END;

  v_title := 'Novo lead: ' || COALESCE(NULLIF(NEW.client_name, ''), 'Cliente');
  v_message := COALESCE(NULLIF(NEW.service_needed, ''), 'Solicitação recebida') || ' — ' || v_origin;
  v_link := '/dashboard/leads/' || NEW.id::text;

  -- INSERT idempotente: o índice único parcial garante dedupe por (user_id, link)
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (v_user_id, 'lead', v_title, v_message, v_link)
  ON CONFLICT (user_id, link) WHERE type = 'lead' AND link IS NOT NULL
  DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca quebrar o INSERT do lead por falha na notificação
  RAISE WARNING '[notify_provider_on_new_lead] failed for lead % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_provider_on_new_lead ON public.leads;
CREATE TRIGGER trg_notify_provider_on_new_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_on_new_lead();