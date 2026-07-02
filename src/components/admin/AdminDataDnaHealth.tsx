import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, AlertOctagon, Activity, GitMerge } from 'lucide-react';

interface DnaHealth {
  totalServices: number;
  servicesWithDna: number;
  servicesNullUserRef: number;
  servicesNullProviderId: number;
  freezeAlerts24h: number;
  triggerErrors24h: number;
  loading: boolean;
}

const initial: DnaHealth = {
  totalServices: 0,
  servicesWithDna: 0,
  servicesNullUserRef: 0,
  servicesNullProviderId: 0,
  freezeAlerts24h: 0,
  triggerErrors24h: 0,
  loading: true,
};

const AdminDataDnaHealth = () => {
  const [stats, setStats] = useState<DnaHealth>(initial);

  useEffect(() => {
    let alive = true;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const load = async () => {
      const [servicesRes, errorsRes] = await Promise.all([
        supabase.from('services').select('id, user_ref, provider_id').is('deleted_at', null),
        supabase
          .from('error_reports' as any)
          .select('id, severity, component_name, action_context, created_at')
          .gte('created_at', since),
      ]);

      const services = (servicesRes.data || []) as Array<{ user_ref: string | null; provider_id: string | null }>;
      const errors = ((errorsRes.data as any[]) || []) as Array<{ severity: string; component_name: string | null; action_context: string | null }>;

      const nullRef = services.filter(s => !s.user_ref).length;
      const nullProv = services.filter(s => !s.provider_id).length;
      const withDna = services.filter(s => !!s.user_ref && !!s.provider_id).length;

      const freezeAlerts = errors.filter(e =>
        e.component_name === 'DashboardUiFreezeMonitor' || /ui[_ ]freeze|overlay/i.test(e.action_context || ''),
      ).length;
      const triggerErrors = errors.filter(e =>
        /trigger|create_service_atomic|auto_migrate_profile_type/i.test(`${e.action_context || ''} ${e.component_name || ''}`),
      ).length;

      if (!alive) return;
      setStats({
        totalServices: services.length,
        servicesWithDna: withDna,
        servicesNullUserRef: nullRef,
        servicesNullProviderId: nullProv,
        freezeAlerts24h: freezeAlerts,
        triggerErrors24h: triggerErrors,
        loading: false,
      });
    };

    load();
    return () => { alive = false; };
  }, []);

  const pctDna = stats.totalServices > 0
    ? Math.round((stats.servicesWithDna / stats.totalServices) * 100)
    : 100;
  const dnaDivergence = stats.servicesNullUserRef > 0 || stats.servicesNullProviderId > 0;

  return (
    <Card className="rounded-2xl border-2 border-primary/20">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Saúde do DNA dos Dados (24h)
          </h3>
          {dnaDivergence ? (
            <Badge variant="destructive" className="gap-1">
              <AlertOctagon className="h-3 w-3" /> Divergência de DNA detectada
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1">
              <ShieldCheck className="h-3 w-3" /> Íntegro
            </Badge>
          )}
        </div>

        {stats.loading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">% Serviços com DNA Completo (provider_id + user_ref)</span>
                <span className={`text-xs font-bold ${pctDna === 100 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {pctDna}% ({stats.servicesWithDna}/{stats.totalServices})
                </span>
              </div>
              <Progress
                value={pctDna}
                className={`h-2 ${pctDna === 100 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-destructive'}`}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMetric
                icon={<GitMerge className="h-4 w-4" />}
                label="user_ref nulos"
                value={stats.servicesNullUserRef}
                tone={stats.servicesNullUserRef > 0 ? 'danger' : 'ok'}
              />
              <MiniMetric
                icon={<Activity className="h-4 w-4" />}
                label="Alertas UI Freeze"
                value={stats.freezeAlerts24h}
                tone={stats.freezeAlerts24h > 0 ? 'warn' : 'ok'}
              />
              <MiniMetric
                icon={<AlertOctagon className="h-4 w-4" />}
                label="Erros de trigger / RPC"
                value={stats.triggerErrors24h}
                tone={stats.triggerErrors24h > 0 ? 'danger' : 'ok'}
              />
            </div>

            {dnaDivergence && (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <strong>Ação imediata:</strong> {stats.servicesNullUserRef} serviço(s) sem <code>user_ref</code> e{' '}
                {stats.servicesNullProviderId} sem <code>provider_id</code>. Verifique a trigger{' '}
                <code>auto_migrate_profile_type</code> e a RPC <code>create_service_atomic</code>.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const MiniMetric = ({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number; tone: 'ok' | 'warn' | 'danger' }) => {
  const cls =
    tone === 'danger' ? 'border-destructive/30 bg-destructive/5 text-destructive'
    : tone === 'warn' ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'
    : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300';
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${cls}`}>
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
};

export default AdminDataDnaHealth;
