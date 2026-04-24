
-- 1. Expandir leads com colunas de follow-up
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_status_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_window_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS last_followup_notified_at timestamptz;

-- 2. Validação de status via trigger (não usamos CHECK pra permitir migrações futuras)
CREATE OR REPLACE FUNCTION public.validate_lead_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('new','contacted','scheduled','completed','lost') THEN
    RAISE EXCEPTION 'Status inválido: %. Use: new, contacted, scheduled, completed ou lost.', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lead_status ON public.leads;
CREATE TRIGGER trg_validate_lead_status
  BEFORE INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead_status();

-- 3. Preferência de follow-up no provider
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS lead_followup_hours integer NOT NULL DEFAULT 24;

CREATE OR REPLACE FUNCTION public.validate_provider_followup_hours()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_followup_hours NOT IN (12,24,48,72) THEN
    RAISE EXCEPTION 'lead_followup_hours deve ser 12, 24, 48 ou 72.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_provider_followup_hours ON public.providers;
CREATE TRIGGER trg_validate_provider_followup_hours
  BEFORE INSERT OR UPDATE OF lead_followup_hours ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.validate_provider_followup_hours();

-- 4. Sincronizar last_status_at + next_followup_at + lead_history a cada mudança
CREATE OR REPLACE FUNCTION public.sync_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window integer;
  v_provider_user uuid;
BEGIN
  -- Recupera janela do prestador (fallback 24h)
  SELECT lead_followup_hours, user_id INTO v_window, v_provider_user
    FROM public.providers WHERE id = NEW.provider_id;
  v_window := COALESCE(v_window, 24);
  NEW.followup_window_hours := v_window;

  IF TG_OP = 'INSERT' THEN
    NEW.last_status_at := now();
    -- Só agenda follow-up se for status que ainda exige ação
    IF NEW.status IN ('new','contacted') THEN
      NEW.next_followup_at := now() + (v_window || ' hours')::interval;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: só age se status mudou
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.last_status_at := now();
    NEW.last_followup_notified_at := NULL;
    IF NEW.status IN ('new','contacted') THEN
      NEW.next_followup_at := now() + (v_window || ' hours')::interval;
    ELSE
      NEW.next_followup_at := NULL;
    END IF;
    -- Registra histórico (author = quem está autenticado, ou provider owner)
    INSERT INTO public.lead_history (lead_id, author_id, entry_type, old_status, new_status)
      VALUES (NEW.id, COALESCE(auth.uid(), v_provider_user), 'status_change', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_status_change ON public.leads;
CREATE TRIGGER trg_sync_lead_status_change
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_status_change();

-- 5. Função de processamento dos lembretes (executada por cron)
CREATE OR REPLACE FUNCTION public.process_lead_followup_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT l.id, l.client_name, l.status, l.followup_window_hours, p.user_id, p.slug
      FROM public.leads l
      JOIN public.providers p ON p.id = l.provider_id
     WHERE l.next_followup_at IS NOT NULL
       AND l.next_followup_at <= now()
       AND l.status IN ('new','contacted')
       AND p.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        r.user_id,
        CASE WHEN r.status = 'new' THEN 'Lead esperando contato' ELSE 'Hora do follow-up' END,
        format('Você ainda não %s com %s. Marque como contatado ou agendado.',
               CASE WHEN r.status = 'new' THEN 'falou' ELSE 'avançou' END,
               r.client_name),
        'lead_followup',
        '/dashboard/leads'
      );
    -- Reagenda para o mesmo intervalo, evita reenviar imediatamente
    UPDATE public.leads
       SET last_followup_notified_at = now(),
           next_followup_at = now() + (r.followup_window_hours || ' hours')::interval
     WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('processed', v_count, 'at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.process_lead_followup_reminders() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_lead_followup_reminders() TO service_role;

-- 6. Backfill: leads existentes ganham last_status_at = created_at
UPDATE public.leads
   SET last_status_at = COALESCE(last_status_at, created_at),
       next_followup_at = CASE
         WHEN status IN ('new','contacted') AND next_followup_at IS NULL
           THEN created_at + interval '24 hours'
         ELSE next_followup_at
       END
 WHERE last_status_at IS NULL OR (status IN ('new','contacted') AND next_followup_at IS NULL);

-- 7. Índice pra cron varrer rápido
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON public.leads (next_followup_at)
  WHERE next_followup_at IS NOT NULL AND status IN ('new','contacted');
