-- Add lost_reason column to leads (motivo de perda capturado no momento da mudança)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason text;

-- Trigger: ao mudar status, registra automaticamente em lead_history com author_id = auth.uid()
-- (substitui qualquer trigger antigo equivalente para garantir captura do motivo)
CREATE OR REPLACE FUNCTION public.record_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_msg text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_actor := auth.uid();
    v_msg := NULL;
    -- Se virou 'lost' e tem motivo informado, registra na mensagem
    IF NEW.status = 'lost' AND NEW.lost_reason IS NOT NULL AND length(trim(NEW.lost_reason)) > 0 THEN
      v_msg := 'Motivo: ' || NEW.lost_reason;
    END IF;
    INSERT INTO public.lead_history (lead_id, author_id, entry_type, old_status, new_status, message)
    VALUES (NEW.id, v_actor, 'status_change', OLD.status, NEW.status, v_msg);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_lead_status_change ON public.leads;
CREATE TRIGGER trg_record_lead_status_change
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.record_lead_status_change();

-- RPC para resolver nomes de autores do histórico (sem expor toda a tabela profiles)
CREATE OR REPLACE FUNCTION public.get_lead_history_authors(p_author_ids uuid[])
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(p_author_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_history_authors(uuid[]) TO authenticated;