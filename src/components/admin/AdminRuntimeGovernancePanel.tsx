/**
 * Runtime Drift Panel · sub-aba dentro de Governance.
 *
 * Consome a engine pura `runtimeGovernance.ts` e mostra:
 *  - Signal Health (overall + por categoria)
 *  - Drift Intelligence (orphan_rpc, dead_flag, dead_metric, etc.)
 *  - Coverage map (blind items por kind)
 *  - Decay timeline (stale/decaying/abandoned)
 *  - Runtime Blast Radius (simulador read-only)
 *
 * Fonte de sinais:
 *  - Tenta agregar a partir de `onboarding_events` (apenas SELECT) com janela
 *    configurável. Falha-soft em "sem sinais ainda" — nunca quebra o painel.
 *
 * Nada aqui executa mutações. Estritamente observacional.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  EyeOff,
  Flame,
  Gauge,
  History,
  Radar,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { GOVERNANCE_REGISTRY, type GovernanceItem } from '@/lib/onboarding/governanceRegistry';
import {
  aggregateRuntimeSnapshot,
  buildCoverageMap,
  classifyDecay,
  computeRuntimeBlastRadius,
  computeSignalHealthScore,
  detectRuntimeDrifts,
  type DecayState,
  type HealthBucket,
  type RuntimeDriftAlert,
  type RuntimeEvent,
  type RuntimeUsageSnapshot,
} from '@/lib/onboarding/runtimeGovernance';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Fonte de sinais (best-effort, falha-soft)
// ---------------------------------------------------------------------------

interface FetchResult {
  events: RuntimeEvent[];
  fetched_at: string;
  error?: string;
}

/**
 * Estratégia simples: lê `onboarding_events` recentes e mapeia para item_ids
 * do registry quando o tag/id do item bate com o nome do evento. Sem PII.
 */
async function fetchRuntimeEvents(windowDays: number): Promise<FetchResult> {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  try {
    const { data, error } = await supabase
      .from('onboarding_events')
      .select('event,phase,session_id,created_at')
      .gte('created_at', since)
      .limit(5000);
    if (error) return { events: [], fetched_at: new Date().toISOString(), error: error.message };

    // Mapping leve: associa cada evento aos items do registry cujo id/tag
    // mencionam o nome do evento ou da fase. É proxy — não payload de usuário.
    const events: RuntimeEvent[] = [];
    const itemsByToken = new Map<string, GovernanceItem[]>();
    for (const it of GOVERNANCE_REGISTRY) {
      const tokens = [it.id.toLowerCase(), ...(it.tags ?? []).map((t) => t.toLowerCase())];
      for (const tk of tokens) {
        const arr = itemsByToken.get(tk) ?? [];
        arr.push(it);
        itemsByToken.set(tk, arr);
      }
    }

    for (const row of data ?? []) {
      const evName = String((row as { event?: string }).event ?? '').toLowerCase();
      const phase = String((row as { phase?: string }).phase ?? '').toLowerCase();
      const ts = new Date(String((row as { created_at?: string }).created_at ?? Date.now())).getTime();
      const sid = (row as { session_id?: string | null }).session_id ?? null;
      const matched = new Set<string>();
      for (const [token, items] of itemsByToken) {
        if (!token) continue;
        if (evName.includes(token) || token.includes(evName) || phase.includes(token)) {
          items.forEach((it) => matched.add(it.id));
        }
      }
      for (const id of matched) {
        events.push({ item_id: id, ts, session_id: sid });
      }
    }
    return { events, fetched_at: new Date().toISOString() };
  } catch (err) {
    return { events: [], fetched_at: new Date().toISOString(), error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Helpers de UI
// ---------------------------------------------------------------------------

const BUCKET_COLOR: Record<HealthBucket, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
  warning: 'bg-amber-500/15 text-amber-700 border-amber-300',
  degraded: 'bg-orange-500/15 text-orange-700 border-orange-300',
  critical: 'bg-destructive/15 text-destructive border-destructive/40',
};

const DECAY_COLOR: Record<DecayState, string> = {
  fresh: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
  stale: 'bg-amber-500/15 text-amber-700 border-amber-300',
  decaying: 'bg-orange-500/15 text-orange-700 border-orange-300',
  abandoned: 'bg-destructive/15 text-destructive border-destructive/40',
};

const DRIFT_LABEL: Record<RuntimeDriftAlert['kind'], string> = {
  orphan_rpc: 'RPC órfã',
  dead_flag: 'Flag morta',
  dead_metric: 'Métrica morta',
  zombie_experiment: 'Experimento zumbi',
  stale_threshold: 'Threshold sem uso',
  unused_engine: 'Engine sem execução',
  dashboard_without_data: 'Dashboard sem dados',
  telemetry_drop: 'Queda de telemetria',
  degraded_signal_quality: 'Qualidade de sinal degradada',
  silent_failure_pattern: 'Falha silenciosa',
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function AdminRuntimeGovernancePanel() {
  const [windowDays, setWindowDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult>({ events: [], fetched_at: '' });
  const [targetId, setTargetId] = useState<string>(GOVERNANCE_REGISTRY[0]?.id ?? '');

  const load = async () => {
    setLoading(true);
    const r = await fetchRuntimeEvents(windowDays);
    setResult(r);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [windowDays]);

  const snapshots = useMemo(
    () => aggregateRuntimeSnapshot(result.events, { window_days: windowDays }),
    [result.events, windowDays],
  );
  const drifts = useMemo(() => detectRuntimeDrifts(GOVERNANCE_REGISTRY, snapshots), [snapshots]);
  const health = useMemo(() => computeSignalHealthScore(GOVERNANCE_REGISTRY, snapshots, drifts), [snapshots, drifts]);
  const coverage = useMemo(() => buildCoverageMap(GOVERNANCE_REGISTRY, snapshots), [snapshots]);
  const decay = useMemo(() => classifyDecay(GOVERNANCE_REGISTRY, snapshots), [snapshots]);
  const blast = useMemo(
    () => (targetId ? computeRuntimeBlastRadius(targetId, GOVERNANCE_REGISTRY, snapshots) : null),
    [targetId, snapshots],
  );

  const hasSignals = result.events.length > 0;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Radar className="h-4 w-4" /> Runtime Governance Signals
            </CardTitle>
            <CardDescription className="text-xs">
              Sinais reais agregados dos últimos {windowDays} dias. Read-only — apenas observa,
              correlaciona, classifica e recomenda. Nada é desligado automaticamente.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[7, 14, 30, 60, 90].map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!hasSignals && (
            <div className="rounded border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              {result.error
                ? `Não foi possível agregar sinais agora (${result.error}). A engine continua funcional — assim que houver telemetria mapeada, os drifts aparecem aqui.`
                : 'Sem eventos correlacionados no período. Em produção, os drifts aparecem conforme a telemetria mapeada for fluindo.'}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="health" className="space-y-3">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="health" className="gap-1"><Gauge className="h-4 w-4" /> Signal Health</TabsTrigger>
          <TabsTrigger value="drifts" className="gap-1"><AlertTriangle className="h-4 w-4" /> Drift Intelligence</TabsTrigger>
          <TabsTrigger value="coverage" className="gap-1"><EyeOff className="h-4 w-4" /> Coverage</TabsTrigger>
          <TabsTrigger value="decay" className="gap-1"><History className="h-4 w-4" /> Decay</TabsTrigger>
          <TabsTrigger value="blast" className="gap-1"><Flame className="h-4 w-4" /> Runtime Blast</TabsTrigger>
        </TabsList>

        {/* SIGNAL HEALTH */}
        <TabsContent value="health" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" /> Score global
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="text-3xl font-semibold">{health.overall_score}</div>
                <Badge variant="outline" className={BUCKET_COLOR[health.overall_bucket]}>
                  {health.overall_bucket}
                </Badge>
              </div>
              <Progress value={health.overall_score} className="h-2" />
            </CardContent>
          </Card>
          <div className="grid gap-2 md:grid-cols-2">
            {health.categories.map((c) => (
              <Card key={c.category}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium capitalize">{c.category}</div>
                    <Badge variant="outline" className={BUCKET_COLOR[c.bucket]}>{c.bucket}</Badge>
                  </div>
                  <Progress value={c.score} className="h-1.5" />
                  <div className="text-[11px] text-muted-foreground">
                    {c.score}/100 · amostra: {c.sample_size}
                    {c.reasons.length > 0 && ` · ${c.reasons.join(' · ')}`}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* DRIFTS */}
        <TabsContent value="drifts" className="space-y-2">
          {drifts.length === 0 && (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhum drift detectado na janela atual.
            </CardContent></Card>
          )}
          {drifts.map((d, i) => (
            <Card key={`${d.item_id}-${i}`} className="border-l-4 border-l-orange-400">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{DRIFT_LABEL[d.kind]}</div>
                  <Badge variant="outline">{d.severity}</Badge>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">{d.item_id}</div>
                <div className="text-xs">{d.reason}</div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* COVERAGE */}
        <TabsContent value="coverage" className="space-y-2">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-sm">
                <span>Cobertura operacional geral</span>
                <span className="font-semibold">{coverage.overall_coverage_pct}%</span>
              </div>
              <Progress value={coverage.overall_coverage_pct} className="h-2 mt-2" />
              <div className="text-[11px] text-muted-foreground mt-1">
                {coverage.blind_total} item(ns) sem sinal observado.
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-2 md:grid-cols-2">
            {coverage.entries.map((e) => (
              <Card key={e.kind}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium capitalize">{e.kind.replace('_', ' ')}</div>
                    <span className="text-xs">{e.monitored}/{e.total}</span>
                  </div>
                  <Progress value={e.coverage_pct} className="h-1.5" />
                  {e.blind_items.length > 0 && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      cegos: {e.blind_items.slice(0, 3).join(', ')}{e.blind_items.length > 3 ? '…' : ''}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* DECAY */}
        <TabsContent value="decay" className="space-y-2">
          {decay
            .filter((d) => d.state !== 'fresh')
            .sort((a, b) => (b.days_since_use ?? 9999) - (a.days_since_use ?? 9999))
            .map((d) => {
              const it = GOVERNANCE_REGISTRY.find((x) => x.id === d.item_id);
              return (
                <Card key={d.item_id}>
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{it?.title ?? d.item_id}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{d.item_id}</div>
                      <div className="text-xs mt-0.5">{d.reason}</div>
                    </div>
                    <Badge variant="outline" className={DECAY_COLOR[d.state]}>{d.state}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          {decay.every((d) => d.state === 'fresh') && (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhum item em estado de decay no momento.
            </CardContent></Card>
          )}
        </TabsContent>

        {/* RUNTIME BLAST */}
        <TabsContent value="blast" className="space-y-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Simular impacto runtime</CardTitle>
              <CardDescription className="text-xs">
                Calcula consumidores reais e seu share de execução observado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOVERNANCE_REGISTRY.map((it) => (
                    <SelectItem key={it.id} value={it.id}>{it.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {blast && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm">{blast.summary}</div>
                  {blast.affected.length > 0 && (
                    <div className="space-y-1">
                      {blast.affected.map((a) => (
                        <div key={a.consumer_id} className="flex items-center justify-between rounded border p-2">
                          <div className="font-mono text-[11px]">{a.consumer_id}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span>{a.observed_executions} exec</span>
                            <span className="text-muted-foreground">·</span>
                            <span>{a.share_pct}%</span>
                            <Badge variant="outline">{a.severity}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
