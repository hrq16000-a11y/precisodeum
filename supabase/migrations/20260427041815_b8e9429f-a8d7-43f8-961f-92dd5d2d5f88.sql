
-- Corrige erro "tuple to be updated was already modified by an operation triggered by the current command"
-- Causa: triggers de sync recíprocos profiles<->providers podem se reativar dentro do mesmo statement.
-- Solução: usar pg_trigger_depth() para garantir que cada trigger só atue na chamada de topo (depth=1).

CREATE OR REPLACE FUNCTION public.sync_profile_to_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Só executa se for a chamada de topo. Se já estamos aninhados em outro trigger,
  -- não tenta sincronizar de volta (evita "tuple already modified").
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public._sync_in_progress() THEN RETURN NEW; END IF;

  IF (NEW.city IS DISTINCT FROM OLD.city) OR (NEW.state IS DISTINCT FROM OLD.state) THEN
    PERFORM set_config('app.sync_in_progress','on', true);
    UPDATE public.providers
       SET city = COALESCE(NULLIF(NEW.city,''), city),
           state = COALESCE(NULLIF(NEW.state,''), state),
           updated_at = now()
     WHERE user_id = NEW.id;
    PERFORM set_config('app.sync_in_progress','off', true);
  END IF;

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.sync_provider_to_related()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Idem: se este trigger foi disparado por outro trigger (ex: sync_profile_to_provider),
  -- não tenta atualizar profiles de volta — isso causa "tuple already modified".
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public._sync_in_progress() THEN RETURN NEW; END IF;
  PERFORM set_config('app.sync_in_progress','on', true);

  IF (NEW.city IS DISTINCT FROM OLD.city) OR (NEW.state IS DISTINCT FROM OLD.state) THEN
    UPDATE public.profiles
       SET city = COALESCE(NULLIF(NEW.city,''), city),
           state = COALESCE(NULLIF(NEW.state,''), state),
           updated_at = now()
     WHERE id = NEW.user_id;
  END IF;

  PERFORM set_config('app.sync_in_progress','off', true);
  RETURN NEW;
END; $function$;
