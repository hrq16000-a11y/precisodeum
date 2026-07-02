/**
 * Executive Panel · /admin/onboarding-ops (aba Executive)
 *
 * Lê snapshots existentes (funnel + releases) e roda o Business Impact Engine
 * de forma puramente client-side. SEM novas tabelas, SEM novas RPCs, SEM
 * billing/financeiro real. Estimativas rotuladas como heurísticas.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Flame,
  GitBranch,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import {
  buildExecutiveSummary,
  computeBusinessHealthScore,
  computeReleaseImpact,
  estimateConversionLoss,
  estimateGrowthTrend,
  estimateLeadImpact,
  estimateOperationalCost,
  rankRiskyReleases,
  rankStableReleases,
  type ExperimentSnapshot,
  type FunnelSnapshot,
  type ReleaseSnapshot,
  type HealthBand,
} from '@/lib/onboarding/businessImpact';

interface FunnelRpcRow {
  phase: string;
  enters: number;
  completes: number;
  abandons: number;
  refreshes: number;
  recoveries: number;
  validation_failed: number;
  autosave_failed: number;
  unique_sessions: number;
}

interface ReleaseRpcRow {
  app_version: string;
  release_channel?: string;
  unique_sessions: number;
  unique_users: number;
  total_events: number;
  completes: number;
  enters: number;
  abandons: number;
  validation_failed: number;
  regressions: number;
}

function aggregateFunnel(rows: FunnelRpcRow[] | null | undefined, windowHours: number): FunnelSnapshot {
  const r = rows ?? [];
  const sum = (k: keyof FunnelRpcRow) => r.reduce((acc, x) => acc + (Number(x[k]) || 0), 0);
  return {
    enters: sum('enters'),
    completes: sum('completes'),
    abandons: sum('abandons'),
    validation_failed: sum('validation_failed'),
    autosave_failed: sum('autosave_failed'),
    recoveries: sum('recoveries'),
    refreshes: sum('refreshes'),
    window_hours: windowHours,
  };
}

const bandColor: Record<HealthBand, string> = {
  excellent: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
  healthy: 'bg-green-500/15 text-green-700 border-green-300',
  warning: 'bg-amber-500/15 text-amber-700 border-amber-300',
  degraded: 'bg-orange-500/15 text-orange-700 border-orange-300',
  critical: 'bg-destructive/15 text-destructive border-destructive/40',
};

const bandLabel: Record<HealthBand, string> = {
  excellent: 'Excelente',
  healthy: 'Saudável',
  warning: 'Atenção',
  degraded: 'Degradado',
  critical: 'Crítico',
};

export default function AdminExecutivePanel() {
  // Janela atual (24h) e baseline (24-48h) — comparação via diferença.
  const current24h = useQuery({
    queryKey: ['admin-exec-funnel', 24],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_onboarding_ops_funnel' as any, { _hours: 24 });
      if (error) throw error;
      return (data ?? []) as FunnelRpcRow[];
    },
    staleTime: 60_000,
  });

  const last7d = useQuery({
    queryKey: ['admin-exec-funnel', 168],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_onboarding_ops_funnel' as any, { _hours: 168 });
      if (error) throw error;
      return (data ?? []) as FunnelRpcRow[];
    },
    staleTime: 5 * 60_000,
  });

  const last30d = useQuery({
    queryKey: ['admin-exec-funnel', 720],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_onboarding_ops_funnel' as any, { _hours: 720 });
      if (error) throw error;
      return (data ?? []) as FunnelRpcRow[];
    },
    staleTime: 10 * 60_000,
  });

  const releasesQ = useQuery({
    queryKey: ['admin-exec-releases'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_onboarding_release_compare' as any, { _hours: 168 });
      if (error) throw error;
      return (data ?? []) as ReleaseRpcRow[];
    },
    staleTime: 5 * 60_000,
  });

  const computed = useMemo(() => {
    const funnel24 = aggregateFunnel(current24h.data, 24);
    const funnel7d = aggregateFunnel(last7d.data, 168);
    const funnel30d = aggregateFunnel(last30d.data, 720);

    // "Janela anterior 24h": derivamos como (7d - 24h) escalado para 24h.
    const previous24h: FunnelSnapshot = (() => {
      const diff = (a: number, b: number) => Math.max(0, a - b);
      const window = 24;
      const totalH = 168 - 24;
      const factor = totalH > 0 ? window / totalH : 0;
      return {
        enters: Math.round(diff(funnel7d.enters, funnel24.enters) * factor),
        completes: Math.round(diff(funnel7d.completes, funnel24.completes) * factor),
        abandons: Math.round(diff(funnel7d.abandons, funnel24.abandons) * factor),
        validation_failed: Math.round(diff(funnel7d.validation_failed, funnel24.validation_failed) * factor),
        autosave_failed: Math.round(diff(funnel7d.autosave_failed, funnel24.autosave_failed) * factor),
        recoveries: Math.round(diff(funnel7d.recoveries, funnel24.recoveries) * factor),
        refreshes: Math.round(diff(funnel7d.refreshes, funnel24.refreshes) * factor),
        window_hours: 24,
      };
    })();

    const releaseSnaps: ReleaseSnapshot[] = (releasesQ.data ?? []).map((r) => ({
      app_version: r.app_version,
      release_channel: r.release_channel,
      unique_sessions: r.unique_sessions,
      completion_rate: r.enters > 0 ? r.completes / r.enters : 0,
      abandon_rate: r.enters > 0 ? r.abandons / r.enters : 0,
      validation_fail_rate: r.enters > 0 ? r.validation_failed / r.enters : 0,
      regressions_detected: r.regressions ?? 0,
    }));

    const experiments: ExperimentSnapshot[] = []; // futuro: ligar à RPC de experiments
    const conversion = estimateConversionLoss({ current: funnel24 });
    const ops = estimateOperationalCost(funnel24);
    const leads = estimateLeadImpact(funnel24);
    const trend7v30 = estimateGrowthTrend(funnel7d, funnel30d);
    const trend1v7 = estimateGrowthTrend(funnel24, previous24h);
    const releaseImpacts = computeReleaseImpact(releaseSnaps);
    const risky = rankRiskyReleases(releaseImpacts, 5);
    const stable = rankStableReleases(releaseImpacts, 5);
    const health = computeBusinessHealthScore({
      funnel: funnel24,
      previousFunnel: previous24h,
      releases: releaseSnaps,
      experiments,
      incidents: [],
    });
    const summary = buildExecutiveSummary({
      health,
      conversion,
      releases: releaseImpacts,
      experiments: [],
    });

    return { funnel24, funnel7d, funnel30d, conversion, ops, leads, trend7v30, trend1v7, risky, stable, health, summary };
  }, [current24h.data, last7d.data, last30d.data, releasesQ.data]);

  const loading = current24h.isLoading || last7d.isLoading || last30d.isLoading || releasesQ.isLoading;

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">Carregando visão executiva…</div>
    );
  }

  const { health, conversion, ops, leads, trend7v30, trend1v7, risky, stable, summary, funnel24 } = computed;

  return (
    <div className="space-y-4">
      {/* HEADER SCORES */}
      <div className="grid gap-3 md:grid-cols-3">
        <ScoreCard
          title="Business Health"
          score={health.score}
          band={health.band}
          icon={<Sparkles className="h-4 w-4" />}
          description="Score consolidado de saúde do onboarding (heurístico, 0–100)."
        />
        <ScoreCard
          title="Operational Health"
          score={health.operational_score}
          band={health.operational_score >= 70 ? 'healthy' : health.operational_score >= 55 ? 'warning' : 'degraded'}
          icon={<Activity className="h-4 w-4" />}
          description="Reflete fricção, recovery, incidentes e estabilidade de releases."
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4" /> Conversão estimada (24h)
            </CardTitle>
            <CardDescription className="text-xs">
              {conversion.sample_sufficient
                ? `Baseline: ${(conversion.baseline_completion_rate * 100).toFixed(1)}%`
                : 'Amostra insuficiente para classificação.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {(conversion.current_completion_rate * 100).toFixed(1)}%
            </div>
            {conversion.estimated_loss_pp > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <ArrowDownRight className="h-3.5 w-3.5" />
                -{conversion.estimated_loss_pp}pp vs baseline · ~{conversion.estimated_users_lost} usuários estimados perdidos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SUMMARY EXECUTIVO */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" /> Resumo executivo
          </CardTitle>
          <CardDescription className="text-xs">
            Geração determinística (sem IA) a partir das métricas atuais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{summary.highest_risk}</p>
          {summary.notes.length > 0 && (
            <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
              {summary.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          <div className="text-xs text-muted-foreground">
            Leads recuperáveis (estimativa): <strong className="text-foreground">{summary.recoverable_leads_estimate}</strong>
          </div>
        </CardContent>
      </Card>

      {/* TENDÊNCIAS + LEADS + OPS */}
      <div className="grid gap-3 md:grid-cols-3">
        <TrendCard label="Hoje vs 24h anteriores" trend={trend1v7} />
        <TrendCard label="7d vs 30d" trend={trend7v30} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Leads no onboarding (24h)</CardTitle>
            <CardDescription className="text-xs">Estimativa heurística sobre completes/abandons.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Gerados: <strong>{leads.estimated_leads_generated}</strong></div>
            <div>Em risco: <strong className="text-amber-700">{leads.estimated_leads_at_risk}</strong></div>
            <div className="text-xs text-muted-foreground">
              Custo operacional: <strong>{ops.cost_score}/100</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RELEASES */}
      <div className="grid gap-3 md:grid-cols-2">
        <ReleaseList title="Releases mais arriscados" icon={<Flame className="h-4 w-4 text-destructive" />} rows={risky} variant="risky" />
        <ReleaseList title="Releases mais estáveis" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} rows={stable} variant="stable" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Snapshot operacional (24h)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <Metric label="Enters" value={funnel24.enters} />
          <Metric label="Completes" value={funnel24.completes} />
          <Metric label="Abandons" value={funnel24.abandons} />
          <Metric label="Recoveries" value={funnel24.recoveries} />
          <Metric label="Validation fails" value={funnel24.validation_failed} />
          <Metric label="Autosave fails" value={funnel24.autosave_failed} />
          <Metric label="Refreshes" value={funnel24.refreshes} />
          <Metric label="Janela (h)" value={funnel24.window_hours} />
        </CardContent>
      </Card>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Todas as estimativas desta tela são <strong>heurísticas determinísticas</strong>, sem ML/IA generativa
        e sem integração financeira real. Servem para apoiar decisão operacional, não para reportar receita.
      </p>
    </div>
  );
}

function ScoreCard({ title, score, band, icon, description }: { title: string; score: number; band: HealthBand; icon: React.ReactNode; description: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">{icon}{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <div className="text-3xl font-bold tabular-nums">{score}</div>
          <Badge variant="outline" className={bandColor[band]}>{bandLabel[band]}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendCard({ label, trend }: { label: string; trend: ReturnType<typeof estimateGrowthTrend> }) {
  const arrow = trend.direction === 'up'
    ? <ArrowUpRight className="h-4 w-4 text-emerald-600" />
    : trend.direction === 'down'
    ? <ArrowDownRight className="h-4 w-4 text-destructive" />
    : <ArrowRight className="h-4 w-4 text-muted-foreground" />;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
        <CardDescription className="text-xs">
          {trend.sample_sufficient ? 'Comparação válida' : 'Amostra insuficiente'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        {arrow}
        <div className="text-2xl font-bold tabular-nums">
          {trend.delta_pp > 0 ? '+' : ''}{trend.delta_pp}pp
        </div>
        <div className="text-xs text-muted-foreground">
          {(trend.previous_rate * 100).toFixed(1)}% → {(trend.current_rate * 100).toFixed(1)}%
        </div>
      </CardContent>
    </Card>
  );
}

function ReleaseList({ title, icon, rows, variant }: { title: string; icon: React.ReactNode; rows: ReturnType<typeof rankRiskyReleases>; variant: 'risky' | 'stable' }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">{icon}{title}</CardTitle>
        <CardDescription className="text-xs">
          {variant === 'risky' ? 'Maior risco operacional/UX' : 'Melhor saúde, amostra suficiente'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-6 pb-4 text-xs text-muted-foreground">Sem dados suficientes ainda.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead className="text-right">Sessões</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">Risco</TableHead>
                <TableHead className="text-right">Perda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.app_version}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3 text-muted-foreground" />
                      {r.app_version}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.sessions}</TableCell>
                  <TableCell className="text-right tabular-nums">{(r.completion_rate * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={
                      r.risk_band === 'critical' ? bandColor.critical
                      : r.risk_band === 'risky' ? bandColor.degraded
                      : r.risk_band === 'watch' ? bandColor.warning
                      : bandColor.healthy
                    }>
                      {r.risk_score}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.estimated_users_lost}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
