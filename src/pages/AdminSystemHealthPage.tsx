import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import {
  Activity, Database, ShieldCheck, Camera, Users, Search, AlertTriangle,
  CheckCircle2, Loader2, Clock, RefreshCw, FileWarning, Gauge, Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Status = 'ok' | 'warn' | 'critical';

interface HealthData {
  signup: {
    last_24h: number; last_7d: number; total: number;
    missing_ref: number; suspicious: number; trigger_latency_ms: number;
  };
  storage: {
    total_albums: number; total_photos: number; total_media: number;
    orphan_albums: number; orphan_photos: number; orphan_media: number;
    missing_user_ref_photos: number;
  };
  search: {
    search_latency_ms: number; approved_providers: number;
    pending_providers: number; indexed_geo: number;
  };
  rls: { tables_total: number; tables_with_rls: number; policies_total: number };
  errors: {
    unresolved_24h: number; critical_24h: number;
    recent: Array<{
      id: string; error_message: string; component_name: string | null;
      page_path: string; severity: string; created_at: string; resolved: boolean;
    }>;
  };
  generated_at: string;
}

interface PerformanceReportRow {
  id: string;
  route: string;
  vitals: Record<string, number>;
  backend: { requestCount?: number; maxDurationMs?: number; slowRequests?: Array<{ name: string; duration: number }> };
  resources: { totalTransferKb?: number; jsTransferKb?: number; imageTransferKb?: number };
  bottlenecks: string[];
  viewport: string | null;
  connection_type: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<Status, { dot: string; ring: string; text: string; bg: string; label: string }> = {
  ok: { dot: 'bg-emerald-500', ring: 'ring-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', label: 'Saudável' },
  warn: { dot: 'bg-amber-500', ring: 'ring-amber-500/20', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', label: 'Atenção' },
  critical: { dot: 'bg-red-500 animate-pulse', ring: 'ring-red-500/20', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', label: 'Crítico' },
};

const StatusPill = ({ status }: { status: Status }) => {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

const Quadrant = ({
  icon: Icon, title, subtitle, status, children,
}: {
  icon: React.ElementType; title: string; subtitle: string; status: Status;
  children: React.ReactNode;
}) => {
  const s = STATUS_STYLES[status];
  return (
    <div className={`relative rounded-2xl border border-border/60 bg-card p-5 shadow-sm ring-1 ${s.ring}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
            <Icon className={`h-5 w-5 ${s.text}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <StatusPill status={status} />
      </div>
      {children}
    </div>
  );
};

const Metric = ({
  label, value, hint, status,
}: { label: string; value: React.ReactNode; hint?: string; status?: Status }) => (
  <div className="rounded-xl border border-border/40 bg-background/50 p-3">
    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className={`mt-1 text-xl font-bold tabular-nums ${status ? STATUS_STYLES[status].text : 'text-foreground'}`}>
      {value}
    </p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

const sevColor = (sev: string) =>
  sev === 'critical' ? 'destructive' : sev === 'high' ? 'destructive' : sev === 'medium' ? 'secondary' : 'outline';

const PERF_TARGETS = { lcp: 2500, inp: 200, cls: 0.1, ttfb: 800 };
const estimateMobileScore = ({ lcp, inp, cls, ttfb }: { lcp: number; inp: number; cls: number; ttfb: number }) => {
  const lcpScore = Math.max(0, 100 - Math.max(0, lcp - PERF_TARGETS.lcp) / 35);
  const inpScore = Math.max(0, 100 - Math.max(0, inp - PERF_TARGETS.inp) / 4);
  const clsScore = Math.max(0, 100 - Math.max(0, cls - PERF_TARGETS.cls) * 500);
  const ttfbScore = Math.max(0, 100 - Math.max(0, ttfb - PERF_TARGETS.ttfb) / 20);
  return Math.round((lcpScore * 0.4) + (inpScore * 0.25) + (clsScore * 0.2) + (ttfbScore * 0.15));
};

export default function AdminSystemHealthPage() {
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['admin-system-health-full'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_system_health_full' as any);
      if (error) throw error;
      return data as unknown as HealthData;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: performanceReports = [] } = useQuery({
    queryKey: ['admin-performance-reports'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('performance_reports' as any) as any)
        .select('id, route, vitals, backend, resources, bottlenecks, viewport, connection_type, created_at')
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data || []) as PerformanceReportRow[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Status calculators
  const signupStatus: Status = !data ? 'ok'
    : data.signup.missing_ref > 0 ? 'critical'
    : data.signup.trigger_latency_ms > 100 ? 'warn'
    : 'ok';

  const storageStatus: Status = !data ? 'ok'
    : (data.storage.orphan_albums + data.storage.orphan_photos + data.storage.orphan_media) > 0 ? 'critical'
    : data.storage.missing_user_ref_photos > 0 ? 'warn'
    : 'ok';

  const searchStatus: Status = !data ? 'ok'
    : data.search.search_latency_ms > 1000 ? 'critical'
    : data.search.search_latency_ms > 500 ? 'warn'
    : 'ok';

  const rlsCoverage = data ? Math.round((data.rls.tables_with_rls / Math.max(1, data.rls.tables_total)) * 100) : 0;
  const rlsStatus: Status = !data ? 'ok'
    : rlsCoverage < 90 ? 'critical'
    : rlsCoverage < 100 ? 'warn'
    : 'ok';

  const overall: Status = [signupStatus, storageStatus, searchStatus, rlsStatus].includes('critical') ? 'critical'
    : [signupStatus, storageStatus, searchStatus, rlsStatus].includes('warn') ? 'warn'
    : 'ok';

  const avgMetric = (key: string) => {
    const values = performanceReports.map((r) => Number(r.vitals?.[key] || 0)).filter((v) => v > 0);
    return values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;
  };
  const avgBackend = Math.round(
    performanceReports.reduce((sum, r) => sum + Number(r.backend?.maxDurationMs || 0), 0) / Math.max(1, performanceReports.length)
  );
  const perfStatus: Status = avgMetric('lcp') > 3500 || avgBackend > 1200 ? 'critical'
    : avgMetric('lcp') > 2500 || avgMetric('ttfb') > 800 || avgBackend > 900 ? 'warn'
    : 'ok';
  const avgLcp = avgMetric('lcp');
  const avgInp = avgMetric('inp');
  const avgCls = Number((performanceReports.map((r) => Number(r.vitals?.cls || 0)).filter((v) => v >= 0).reduce((sum, v) => sum + v, 0) / Math.max(1, performanceReports.length)).toFixed(3));
  const avgTtfb = avgMetric('ttfb');
  const mobileScore = estimateMobileScore({ lcp: avgLcp, inp: avgInp || 200, cls: avgCls, ttfb: avgTtfb });
  const scoreProgress = Math.min(100, Math.round((mobileScore / 80) * 100));

  return (
    <AdminLayout>
      <div className="space-y-5 p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${STATUS_STYLES[overall].bg}`}>
                <Activity className={`h-5 w-5 ${STATUS_STYLES[overall].text}`} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Saúde do Sistema</h1>
                <p className="text-sm text-muted-foreground">
                  Cockpit de integridade em tempo real · {data ? `atualizado ${formatDistanceToNow(new Date(data.generated_at), { addSuffix: true, locale: ptBR })}` : '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={overall} />
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Atualizar
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Erro ao carregar dados: {(error as Error).message}
          </div>
        )}

        {isLoading && (
          <div className="rounded-2xl border border-border/60 bg-card p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Sondando o sistema…</p>
          </div>
        )}

        {data && (
          <>
            {/* 4 Quadrantes */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* A - Cadastro */}
              <Quadrant icon={Users} title="Saúde do Cadastro" subtitle="Porta de entrada · últimas 24h / 7d" status={signupStatus}>
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Novos 24h" value={data.signup.last_24h} />
                  <Metric label="Novos 7d" value={data.signup.last_7d} />
                  <Metric label="Total" value={data.signup.total.toLocaleString('pt-BR')} />
                  <Metric
                    label="Sem user_ref"
                    value={data.signup.missing_ref}
                    status={data.signup.missing_ref > 0 ? 'critical' : 'ok'}
                    hint={data.signup.missing_ref === 0 ? 'Trigger íntegra' : 'Trigger falhou'}
                  />
                  <Metric label="Suspeitos" value={data.signup.suspicious} status={data.signup.suspicious > 5 ? 'warn' : 'ok'} />
                  <Metric
                    label="Latência trigger"
                    value={`${data.signup.trigger_latency_ms}ms`}
                    status={data.signup.trigger_latency_ms > 100 ? 'warn' : 'ok'}
                    hint="Meta < 100ms"
                  />
                </div>
              </Quadrant>

              {/* B - Storage / Portfolio */}
              <Quadrant icon={Camera} title="Integridade do Portfólio" subtitle="Storage · álbuns · fotos · mídia" status={storageStatus}>
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Álbuns" value={data.storage.total_albums} />
                  <Metric label="Fotos" value={data.storage.total_photos} />
                  <Metric label="Mídia ativa" value={data.storage.total_media} />
                  <Metric
                    label="Álbuns órfãos"
                    value={data.storage.orphan_albums}
                    status={data.storage.orphan_albums > 0 ? 'critical' : 'ok'}
                  />
                  <Metric
                    label="Fotos órfãs"
                    value={data.storage.orphan_photos}
                    status={data.storage.orphan_photos > 0 ? 'critical' : 'ok'}
                  />
                  <Metric
                    label="Mídia sem dono"
                    value={data.storage.orphan_media}
                    status={data.storage.orphan_media > 0 ? 'critical' : 'ok'}
                  />
                </div>
              </Quadrant>

              {/* C - Busca */}
              <Quadrant icon={Search} title="Performance da Busca" subtitle="Motor admin & front · sondagem ao vivo" status={searchStatus}>
                <div className="grid grid-cols-2 gap-2">
                  <Metric
                    label="Latência consulta"
                    value={`${data.search.search_latency_ms}ms`}
                    status={searchStatus}
                    hint="Vermelho > 1s"
                  />
                  <Metric label="Aprovados" value={data.search.approved_providers} />
                  <Metric label="Pendentes" value={data.search.pending_providers} status={data.search.pending_providers > 10 ? 'warn' : 'ok'} />
                  <Metric
                    label="Geo indexada"
                    value={`${data.search.indexed_geo}/${data.search.approved_providers}`}
                    hint={`${Math.round((data.search.indexed_geo / Math.max(1, data.search.approved_providers)) * 100)}% com GPS`}
                  />
                </div>
              </Quadrant>

              {/* D - RLS */}
              <Quadrant icon={ShieldCheck} title="Conformidade RLS" subtitle="Políticas de segurança ativas" status={rlsStatus}>
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Tabelas" value={data.rls.tables_total} />
                  <Metric
                    label="Com RLS"
                    value={data.rls.tables_with_rls}
                    status={rlsStatus}
                    hint={`${rlsCoverage}% cobertura`}
                  />
                  <Metric label="Políticas" value={data.rls.policies_total} />
                </div>
                <div className="mt-3 rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
                  <Database className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Profissionais só conseguem ler/escrever nos próprios recursos via políticas <code className="text-[10px] bg-background px-1 rounded">auth.uid() = user_id</code>.
                </div>
              </Quadrant>
            </div>

            {/* Log de erros silenciosos */}
            <Quadrant icon={Timer} title="Relatório de Performance Real" subtitle="Core Web Vitals · TTFB · LCP · backend" status={perfStatus}>
              <div className="mb-4 rounded-xl border border-border/40 bg-background/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Meta PageSpeed mobile</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{mobileScore}/80</p>
                  </div>
                  <Badge variant={mobileScore >= 70 ? 'secondary' : 'outline'} className="text-[10px]">
                    {mobileScore >= 70 ? 'Próximo da meta 70/80' : `${Math.max(0, 70 - mobileScore)} pts até 70`}
                  </Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${scoreProgress}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground md:grid-cols-4">
                  <span>LCP meta {PERF_TARGETS.lcp}ms</span>
                  <span>INP meta {PERF_TARGETS.inp}ms</span>
                  <span>CLS meta {PERF_TARGETS.cls}</span>
                  <span>TTFB meta {PERF_TARGETS.ttfb}ms</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Metric label="Amostras" value={performanceReports.length} />
                <Metric label="TTFB médio" value={`${avgTtfb}ms`} status={avgTtfb > PERF_TARGETS.ttfb ? 'warn' : 'ok'} />
                <Metric label="LCP médio" value={`${avgLcp}ms`} status={avgLcp > PERF_TARGETS.lcp ? 'warn' : 'ok'} />
                <Metric label="INP médio" value={`${avgInp}ms`} status={avgInp > PERF_TARGETS.inp ? 'warn' : 'ok'} />
                <Metric label="Backend máx." value={`${avgBackend}ms`} status={avgBackend > 900 ? 'warn' : 'ok'} />
              </div>
              <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
                {performanceReports.slice(0, 8).map((report) => (
                  <div key={report.id} className="rounded-lg border border-border/40 bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{report.route}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      TTFB {Math.round(report.vitals?.ttfb || 0)}ms · LCP {Math.round(report.vitals?.lcp || 0)}ms · JS {Math.round(report.resources?.jsTransferKb || 0)}KB · backend {Math.round(report.backend?.maxDurationMs || 0)}ms
                    </p>
                    {report.bottlenecks?.[0] && (
                      <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{report.bottlenecks[0]}</p>
                    )}
                  </div>
                ))}
                {performanceReports.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Aguardando as primeiras medições reais dos visitantes.</p>
                )}
              </div>
            </Quadrant>

            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${data.errors.unresolved_24h > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                    <FileWarning className={`h-5 w-5 ${data.errors.unresolved_24h > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Log de Erros Silenciosos</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Capturados automaticamente · últimas 24h
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={data.errors.critical_24h > 0 ? 'destructive' : 'secondary'} className="text-[10px]">
                    {data.errors.critical_24h} críticos
                  </Badge>
                  <Badge variant={data.errors.unresolved_24h > 0 ? 'destructive' : 'outline'} className="text-[10px]">
                    {data.errors.unresolved_24h} não resolvidos
                  </Badge>
                </div>
              </div>

              {data.errors.recent.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-medium text-foreground">Nenhum erro silencioso nas últimas 24h</p>
                  <p className="text-[11px] text-muted-foreground">Sistema operando dentro do esperado</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {data.errors.recent.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/30 p-3">
                      <Badge variant={sevColor(e.severity) as any} className="text-[9px] uppercase shrink-0 mt-0.5">
                        {e.severity}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{e.error_message}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          {e.component_name && <span className="font-mono">{e.component_name}</span>}
                          <span>·</span>
                          <span>{e.page_path}</span>
                          <span>·</span>
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                      {e.resolved && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer rodapé */}
            <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-muted-foreground">
              <Gauge className="h-3 w-3" />
              Auto-refresh a cada 60s · próxima sondagem automática
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
