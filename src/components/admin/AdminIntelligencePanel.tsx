/**
 * Decision Intelligence Panel · /admin/onboarding-ops → tab "Intelligence"
 *
 * Lê signals já agregados (funnel + releases + behavioral + experiments +
 * incidents + regressions) e roda o decision engine determinístico.
 * NÃO executa ações — apenas exibe diagnósticos, ações sugeridas e
 * forensic summaries.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Info,
  RefreshCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import {
  analyzeOperationalState,
  computeGlobalOperationalScore,
  generateForensicSummary,
  type DecisionInput,
  type Diagnostic,
  type FunnelPhaseSignal,
  type ReleaseSignal,
} from '@/lib/onboarding/decisionEngine';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-destructive bg-destructive/10 text-destructive',
  high: 'border-orange-500/60 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  medium: 'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  low: 'border-muted bg-muted/30 text-muted-foreground',
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export default function AdminIntelligencePanel() {
  const [hours, setHours] = useState<number>(24);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['onboarding-intelligence', hours],
    queryFn: async (): Promise<DecisionInput> => {
      // Funil
      const { data: funnel } = await supabase.rpc('admin_onboarding_ops_funnel' as any, { _hours: hours });
      // Releases (best-effort, RPC pode não existir em todos os ambientes)
      let releases: ReleaseSignal[] = [];
      try {
        const res = await supabase.rpc('admin_onboarding_release_compare' as any, { _hours: hours });
        const rows = (res.data ?? []) as Array<any>;
        releases = rows.map((r) => ({
          app_version: r.app_version ?? 'unknown',
          release_channel: r.release_channel ?? 'unknown',
          unique_sessions: Number(r.unique_sessions ?? 0),
          completes: Number(r.completes ?? 0),
          abandons: Number(r.abandons ?? 0),
          validation_failures: Number(r.validation_failures ?? r.validation_failed ?? 0),
          autosave_failures: Number(r.autosave_failures ?? r.autosave_failed ?? 0),
          completion_rate: r.unique_sessions > 0 ? Number(r.completes ?? 0) / Number(r.unique_sessions) : 0,
        }));
      } catch {
        releases = [];
      }
      // Behavioral
      let behavioral: any[] = [];
      try {
        const res = await supabase.rpc('admin_onboarding_behavioral_summary' as any, { _hours: hours });
        behavioral = (res.data ?? []) as any[];
      } catch {
        behavioral = [];
      }

      const funnelRows = ((funnel ?? []) as any[]).map(
        (r): FunnelPhaseSignal => ({
          phase: r.phase,
          enters: Number(r.enters ?? 0),
          exits: Number(r.exits ?? 0),
          completes: Number(r.completes ?? 0),
          abandons: Number(r.abandons ?? 0),
          refreshes: Number(r.refreshes ?? 0),
          recoveries: Number(r.recoveries ?? 0),
          validation_failed: Number(r.validation_failed ?? 0),
          autosave_failed: Number(r.autosave_failed ?? 0),
          regressions: Number(r.regressions ?? 0),
          unique_sessions: Number(r.unique_sessions ?? 0),
          unique_users: Number(r.unique_users ?? 0),
        }),
      );

      return {
        funnel: funnelRows,
        releases,
        behavioral: (behavioral || []).map((b: any) => ({
          phase: b.phase ?? 'unknown',
          rage_clicks: Number(b.rage_clicks ?? 0),
          hesitations: Number(b.hesitations ?? 0),
          repeated_validation_errors: Number(b.repeated_validation_errors ?? 0),
          problematic_fields: Array.isArray(b.problematic_fields) ? b.problematic_fields : undefined,
          device: b.device ?? undefined,
        })),
        experiments: [], // opcional — admin pode preencher via panel de experimentos
        incidents: [],
        regressions: [],
        window_hours: hours,
      };
    },
    staleTime: 60_000,
  });

  const diagnostics = useMemo<Diagnostic[]>(
    () => (data ? analyzeOperationalState(data) : []),
    [data],
  );
  const score = useMemo(() => computeGlobalOperationalScore(diagnostics), [diagnostics]);
  const summary = useMemo(() => (data ? generateForensicSummary(data) : null), [data]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Centro de Inteligência Operacional
              </CardTitle>
              <CardDescription>
                Diagnósticos determinísticos sobre o estado do onboarding. Apenas recomendações — nenhuma ação automática.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1h</SelectItem>
                  <SelectItem value="6">6h</SelectItem>
                  <SelectItem value="24">24h</SelectItem>
                  <SelectItem value="72">72h</SelectItem>
                  <SelectItem value="168">7d</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <ScoreCard label="Score operacional" value={`${score}/100`} tone={scoreTone(score)} />
              <ScoreCard label="Diagnósticos ativos" value={String(diagnostics.length)} tone={diagnostics.length === 0 ? 'good' : 'warn'} />
              <ScoreCard
                label="Críticos / Altos"
                value={String(diagnostics.filter((d) => d.severity === 'critical' || d.severity === 'high').length)}
                tone={diagnostics.some((d) => d.severity === 'critical') ? 'bad' : 'warn'}
              />
              <ScoreCard
                label="Perda estimada (pp)"
                value={String(Math.round(diagnostics.reduce((a, d) => a + d.est_completion_loss_pp, 0)))}
                tone={diagnostics.length === 0 ? 'good' : 'warn'}
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Analisando sinais…</CardContent></Card>
        ) : diagnostics.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Nenhum padrão preocupante detectado na janela selecionada.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {diagnostics.map((d) => (
              <DiagnosticCard key={d.id} d={d} />
            ))}
          </div>
        )}

        {summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Forensic Summaries
              </CardTitle>
              <CardDescription>Top sinais agregados na janela selecionada.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <SummaryBlock title="Top causas de abandono">
                {summary.top_abandonment_causes.length === 0 ? (
                  <Empty />
                ) : (
                  summary.top_abandonment_causes.map((x) => (
                    <Row key={x.phase} label={x.phase} value={`${x.abandons} abandonos`} />
                  ))
                )}
              </SummaryBlock>
              <SummaryBlock title="Releases mais arriscados">
                {summary.riskiest_releases.length === 0 ? (
                  <Empty />
                ) : (
                  summary.riskiest_releases.map((x) => (
                    <Row key={`${x.app_version}-${x.channel}`} label={`${x.app_version} · ${x.channel}`} value={`-${x.drop_pp}pp`} tone="bad" />
                  ))
                )}
              </SummaryBlock>
              <SummaryBlock title="Campos com mais fricção">
                {summary.most_friction_fields.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {summary.most_friction_fields.map((f) => (
                      <Badge key={f} variant="outline">{f}</Badge>
                    ))}
                  </div>
                )}
              </SummaryBlock>
              <SummaryBlock title="Fases mais instáveis">
                {summary.most_unstable_phases.length === 0 ? (
                  <Empty />
                ) : (
                  summary.most_unstable_phases.map((x) => (
                    <Row key={x.phase} label={x.phase} value={`score ${x.instability_score}`} />
                  ))
                )}
              </SummaryBlock>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

function DiagnosticCard({ d }: { d: Diagnostic }) {
  return (
    <Card className={`border-2 ${SEVERITY_STYLES[d.severity] ?? ''}`}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <IconForSeverity severity={d.severity} />
            <div>
              <CardTitle className="text-base">{d.suspected_root_cause}</CardTitle>
              <CardDescription className="mt-1">{d.explanation}</CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="text-xs">{PRIORITY_LABEL[d.priority]}</Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs cursor-help">conf: {d.confidence}</Badge>
              </TooltipTrigger>
              <TooltipContent>Confidence baseado em tamanho amostral e força do sinal.</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {d.affected_phases.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-muted-foreground">Fases:</span>
            {d.affected_phases.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}
          </div>
        )}
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded border bg-background/50 p-2">
            <div className="text-muted-foreground">Usuários afetados/hora</div>
            <div className="text-lg font-semibold">{d.est_users_affected_per_hour}</div>
          </div>
          <div className="rounded border bg-background/50 p-2">
            <div className="text-muted-foreground">Perda estimada de completion</div>
            <div className="text-lg font-semibold">{d.est_completion_loss_pp} pp</div>
          </div>
        </div>
        {d.suggested_actions.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium">
              <Target className="h-3 w-3" /> Ações sugeridas
            </div>
            <ul className="space-y-1 text-sm">
              {d.suggested_actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.causal_chain && d.causal_chain.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium">
              <Info className="h-3 w-3" /> Cadeia causal
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {d.causal_chain.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <Badge variant="outline" className="font-mono">{c.from}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  {i === d.causal_chain!.length - 1 && <Badge variant="outline" className="font-mono">{c.to}</Badge>}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IconForSeverity({ severity }: { severity: string }) {
  if (severity === 'critical') return <AlertOctagon className="h-5 w-5 shrink-0" />;
  if (severity === 'high') return <AlertTriangle className="h-5 w-5 shrink-0" />;
  return <Info className="h-5 w-5 shrink-0" />;
}

function ScoreCard({ label, value, tone }: { label: string; value: string; tone: 'good' | 'warn' | 'bad' }) {
  const cls =
    tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'bad' ? 'text-destructive'
    : 'text-amber-600 dark:text-amber-400';
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function scoreTone(s: number): 'good' | 'warn' | 'bad' {
  if (s >= 80) return 'good';
  if (s >= 50) return 'warn';
  return 'bad';
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div className="flex items-center justify-between rounded border bg-background/40 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === 'bad' ? 'text-destructive font-medium' : 'font-medium'}>{value}</span>
    </div>
  );
}

function Empty() {
  return <div className="text-xs italic text-muted-foreground">Sem dados na janela.</div>;
}
