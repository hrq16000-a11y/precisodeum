-- Imutabilidade dos logs: bloquear UPDATE/DELETE para todos os roles autenticados/anon.
-- service_role e cron continuam podendo manipular (purge_cold_storage_91d, expire_registration_blocks_180d).

-- system_audit_logs: imutável após inserido
DROP POLICY IF EXISTS "no_update_system_audit_logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "no_delete_system_audit_logs" ON public.system_audit_logs;
CREATE POLICY "no_update_system_audit_logs" ON public.system_audit_logs
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "no_delete_system_audit_logs" ON public.system_audit_logs
  FOR DELETE TO authenticated, anon USING (false);

-- account_cold_storage: só service_role pode mexer (purge cron)
DROP POLICY IF EXISTS "no_update_cold_storage" ON public.account_cold_storage;
DROP POLICY IF EXISTS "no_delete_cold_storage" ON public.account_cold_storage;
DROP POLICY IF EXISTS "no_insert_cold_storage" ON public.account_cold_storage;
CREATE POLICY "no_update_cold_storage" ON public.account_cold_storage
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "no_delete_cold_storage" ON public.account_cold_storage
  FOR DELETE TO authenticated, anon USING (false);
CREATE POLICY "no_insert_cold_storage" ON public.account_cold_storage
  FOR INSERT TO authenticated, anon WITH CHECK (false);

-- registration_blocks: usuário não pode editar/remover seu próprio bloqueio
DROP POLICY IF EXISTS "no_update_registration_blocks" ON public.registration_blocks;
DROP POLICY IF EXISTS "no_delete_registration_blocks" ON public.registration_blocks;
DROP POLICY IF EXISTS "no_insert_registration_blocks" ON public.registration_blocks;
CREATE POLICY "no_update_registration_blocks" ON public.registration_blocks
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "no_delete_registration_blocks" ON public.registration_blocks
  FOR DELETE TO authenticated, anon USING (false);
CREATE POLICY "no_insert_registration_blocks" ON public.registration_blocks
  FOR INSERT TO authenticated, anon WITH CHECK (false);

-- Trigger anti-tampering em system_audit_logs: bloqueia UPDATE/DELETE até para postgres em sessão authenticated
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite apenas para service_role (jobs, cron) e quando current_user é postgres direto
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' IN ('authenticated','anon') THEN
    RAISE EXCEPTION 'audit logs are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_tamper_update ON public.system_audit_logs;
DROP TRIGGER IF EXISTS trg_prevent_audit_tamper_delete ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_audit_tamper_update
  BEFORE UPDATE ON public.system_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_tampering();
CREATE TRIGGER trg_prevent_audit_tamper_delete
  BEFORE DELETE ON public.system_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- Cron jobs: purga de cold storage (diário às 03:30) e expiração de blocks (diário às 03:45)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('purge-cold-storage-91d') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='purge-cold-storage-91d');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.schedule(
      'purge-cold-storage-91d',
      '30 3 * * *',
      $job$ SELECT public.purge_cold_storage_91d(); $job$
    );
    PERFORM cron.schedule(
      'expire-registration-blocks-180d',
      '45 3 * * *',
      $job$ SELECT public.expire_registration_blocks_180d(); $job$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END$$;