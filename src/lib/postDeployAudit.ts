/**
 * Post-deploy audit: validates the health of create_service_atomic + DNA integrity.
 * Runs once per admin session (cached in sessionStorage) and emits a structured
 * console log + a sonner toast summary so admins see the outcome immediately
 * after each deploy.
 */
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SESSION_KEY = 'admin:postDeployAudit:v1';

interface AuditOutcome {
  ranAt: string;
  totalServices: number;
  servicesNullDna: number;
  recentErrors: number;
  ok: boolean;
}

export async function runPostDeployAudit(): Promise<AuditOutcome | null> {
  if (typeof window === 'undefined') return null;
  if (sessionStorage.getItem(SESSION_KEY)) return null;

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [servicesRes, errorsRes] = await Promise.all([
      supabase.from('services').select('id, user_ref, provider_id').is('deleted_at', null),
      supabase
        .from('error_reports' as any)
        .select('id, action_context, component_name')
        .gte('created_at', since24h),
    ]);

    const services = (servicesRes.data || []) as Array<{ user_ref: string | null; provider_id: string | null }>;
    const errors = ((errorsRes.data as any[]) || []) as Array<{ action_context: string | null; component_name: string | null }>;

    const nullDna = services.filter(s => !s.user_ref || !s.provider_id).length;
    const rpcErrors = errors.filter(e =>
      /create_service_atomic|auto_migrate_profile_type|trigger/i.test(`${e.action_context || ''} ${e.component_name || ''}`),
    ).length;

    const outcome: AuditOutcome = {
      ranAt: new Date().toISOString(),
      totalServices: services.length,
      servicesNullDna: nullDna,
      recentErrors: rpcErrors,
      ok: nullDna === 0 && rpcErrors === 0,
    };

    // Structured log so the deploy dashboard can ingest it
    // eslint-disable-next-line no-console
    console.info('[post-deploy:audit]', JSON.stringify(outcome));

    if (outcome.ok) {
      toast.success('Auditoria pós-deploy: sistema íntegro', {
        description: `${services.length} serviços com DNA completo · 0 erros de RPC nas últimas 24h`,
        duration: 4000,
      });
    } else {
      toast.error('Auditoria pós-deploy: divergência detectada', {
        description: `${nullDna} serviço(s) sem DNA · ${rpcErrors} erro(s) de trigger/RPC nas últimas 24h`,
        duration: 8000,
      });
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(outcome));
    return outcome;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[post-deploy:audit] falhou', err);
    return null;
  }
}
