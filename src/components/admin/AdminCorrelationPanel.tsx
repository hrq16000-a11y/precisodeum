/**
 * Cross-Engine Correlation Center · aba "Correlation"
 *
 * Painel read-only, determinístico, sem realtime, sem polling agressivo.
 * Lê `onboarding_events` recentes (janela curta) e materializa findings
 * sintéticos para alimentar a engine de correlação. Fail-soft.
 *
 * NÃO altera onboarding, NÃO mitiga, NÃO faz IO além de leitura.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, GitMerge, Layers, Network, Sigma, Workflow } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  correlateOperationalFindings,
  type CorrelationFinding,
  type CorrelationInput,
  type CorrelationEngine,
} from '@/lib/onboarding/operationalCorrelation';

interface Props {
  enabled?: boolean;
  /** Janela em horas para hidratar findings sintéticos a partir de onboarding_events. */
  windowHours?: number;
}

interface RawEvent {
  id: string;
  event: string;
  phase: string | null;
  session_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const SEV_COLOR: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  critical: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

function classifyEngine(ev: string): CorrelationEngine | null {
  const e = ev.toLowerCase();
  if (e.includes('reality') || e.includes('phantom') || e.includes('silent_failure')) return 'reality';
  if (e.includes('memory') || e.includes('recurrence') || e.includes('chronic')) return 'memory';
  if (e.includes('hardening') || e.includes('chaos') || e.includes('retry')) return 'hardening';
  if (e.includes('evidence') || e.includes('truth')) return 'evidence';
  if (e.includes('self_audit') || e.includes('parity') || e.includes('drift')) return 'self_audit';
  if (e.includes('governance') || e.includes('flag') || e.includes('rpc')) return 'governance';
  if (e.includes('error') || e.includes('regression')) return 'reality';
  return null;
}

function severityFromMeta(meta: Record<string, unknown> | null): 'low' | 'medium' | 'high' | 'critical' {
  const v = (meta?.severity ?? meta?.level ?? '').toString().toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low') return v;
  if (v === 'error' || v === 'fatal') return 'high';
  return 'low';
}

function buildInputFromEvents(rows: RawEvent[]): CorrelationInput {
  const buckets: Record<CorrelationEngine, CorrelationFinding[]> = {
    reality: [],
    memory: [],
    hardening: [],
    evidence: [],
    self_audit: [],
    governance: [],
  };
  for (const r of rows) {
    const eng = classifyEngine(r.event);
    if (!eng) continue;
    buckets[eng].push({
      id: r.id,
      detector: r.event,
      phase: r.phase ?? undefined,
      sessionId: r.session_id ?? undefined,
      severity: severityFromMeta(r.meta),
      confidence: 0.6,
      observedAt: r.created_at,
      tags: Object.keys(r.meta ?? {}).slice(0, 5),
    });
  }
  return {
    reality: buckets.reality,
    memory: buckets.memory,
    hardening: buckets.hardening,
    evidence: buckets.evidence,
    selfAudit: buckets.self_audit,
    governance: buckets.governance,
  };
}

export default function AdminCorrelationPanel({ enabled = true, windowHours = 24 }: Props) {
  const { data, isLoading, isError } = useQuery({
    enabled,
    queryKey: ['admin-correlation', windowHours],
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
      const { data, error } = await supabase
        .from('onboarding_events')
        .select('id,event,phase,session_id,meta,created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as RawEvent[];
    },
  });

  const snapshot = useMemo(() => {
    if (!data) return null;
    return correlateOperationalFindings(buildInputFromEvents(data));
  }, [data]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Falha ao carregar dados de correlação. (read-only, fail-soft)
        </CardContent>
      </Card>
    );
  }
  if (!snapshot) return null;

  const s = snapshot.scores;

  return (
    <div className="space-y-4">
      {/* Scores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScoreCard icon={<Sigma className="h-4 w-4" />} label="Operational Entropy" value={s.operational_entropy} invert />
        <ScoreCard icon={<Workflow className="h-4 w-4" />} label="Systemic Stability" value={s.systemic_stability} />
        <ScoreCard icon={<Network className="h-4 w-4" />} label="Correlation Confidence" value={s.correlation_confidence} />
        <ScoreCard icon={<Layers className="h-4 w-4" />} label="Runtime Cohesion" value={s.runtime_cohesion} />
      </div>

      <Tabs defaultValue="incidents" className="space-y-3">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="incidents" className="gap-1"><AlertTriangle className="h-4 w-4" /> Incidents</TabsTrigger>
          <TabsTrigger value="chains" className="gap-1"><GitMerge className="h-4 w-4" /> Chains</TabsTrigger>
          <TabsTrigger value="entropy" className="gap-1"><Sigma className="h-4 w-4" /> Entropy</TabsTrigger>
          <TabsTrigger value="consensus" className="gap-1"><Layers className="h-4 w-4" /> Consensus</TabsTrigger>
          <TabsTrigger value="propagation" className="gap-1"><Network className="h-4 w-4" /> Propagation</TabsTrigger>
          <TabsTrigger value="systemic" className="gap-1"><Workflow className="h-4 w-4" /> Systemic</TabsTrigger>
        </TabsList>

        <TabsContent value="incidents">
          <Card>
            <CardHeader><CardTitle className="text-sm">Correlated Incidents</CardTitle></CardHeader>
            <CardContent>
              {snapshot.correlatedIncidents.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem incidentes correlacionados na janela atual.</div>
              ) : (
                <ScrollArea className="h-[420px] pr-2">
                  <ul className="space-y-2">
                    {snapshot.correlatedIncidents.map((inc) => (
                      <li key={inc.id} className="rounded-md border p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={SEV_COLOR[inc.severity]}>{inc.severity}</Badge>
                          <span className="font-medium text-sm">{inc.pattern}</span>
                          <span className="text-xs text-muted-foreground">conf {(inc.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{inc.rationale}</div>
                        <div className="text-xs mt-1">
                          engines: {inc.supportingEngines.join(', ') || '—'}
                          {inc.conflictingEngines.length > 0 && (
                            <span className="text-orange-600"> · conflito: {inc.conflictingEngines.join(', ')}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chains">
          <Card>
            <CardHeader><CardTitle className="text-sm">Propagation Chains</CardTitle></CardHeader>
            <CardContent>
              {snapshot.propagationChains.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem cadeias detectadas.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {snapshot.propagationChains.map((c) => (
                    <li key={c.id} className="rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <Badge className={SEV_COLOR[c.severity]}>{c.severity}</Badge>
                        <span className="text-xs text-muted-foreground">depth {c.depth} · conf {(c.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="text-xs mt-1">{c.nodeIds.join(' → ')}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entropy">
          <Card>
            <CardHeader><CardTitle className="text-sm">Entropy Breakdown</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>Entropy: <strong>{s.operational_entropy}</strong> / 100 (alto = ruim)</div>
              <div>Stability: <strong>{s.systemic_stability}</strong> / 100</div>
              <div>Cohesion: <strong>{s.runtime_cohesion}</strong> / 100</div>
              <div className="text-xs text-muted-foreground">
                Considera findings críticos, contradições entre engines, fragmentação de sessão,
                loops ocultos e cascatas.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consensus">
          <Card>
            <CardHeader><CardTitle className="text-sm">Engine Consensus Matrix</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left py-1">Engine</th>
                    <th className="text-right py-1">Findings</th>
                    <th className="text-right py-1">Conf</th>
                    <th className="text-right py-1">Agreement</th>
                    <th className="text-right py-1">Contradict</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.confidenceMatrix.map((r) => (
                    <tr key={r.engine} className="border-t">
                      <td className="py-1">{r.engine}</td>
                      <td className="py-1 text-right">{r.findings}</td>
                      <td className="py-1 text-right">{(r.avgConfidence * 100).toFixed(0)}%</td>
                      <td className="py-1 text-right">{(r.agreementScore * 100).toFixed(0)}%</td>
                      <td className="py-1 text-right">{(r.contradictionScore * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="propagation">
          <Card>
            <CardHeader><CardTitle className="text-sm">Propagation Graph</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>Nós: <strong>{snapshot.propagationGraph.nodes.length}</strong></div>
              <div>Edges: <strong>{snapshot.propagationGraph.edges.length}</strong></div>
              <div>Depth: <strong>{snapshot.propagationGraph.depth}</strong></div>
              <div>Clusters isolados: <strong>{snapshot.propagationGraph.isolatedClusters}</strong></div>
              <div>Convergência: <strong>{(snapshot.propagationGraph.convergence * 100).toFixed(0)}%</strong></div>
              <div>Divergência: <strong>{(snapshot.propagationGraph.divergence * 100).toFixed(0)}%</strong></div>
              {snapshot.propagationGraph.systemicHotspots.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Hotspots: {snapshot.propagationGraph.systemicHotspots.join(', ')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="systemic">
          <Card>
            <CardHeader><CardTitle className="text-sm">Systemic Patterns</CardTitle></CardHeader>
            <CardContent>
              {snapshot.systemicPatterns.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem padrões sistêmicos detectados.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {snapshot.systemicPatterns.map((p) => (
                    <li key={p.pattern} className="rounded-md border p-2 flex items-center gap-2 flex-wrap">
                      <Badge className={SEV_COLOR[p.severity]}>{p.severity}</Badge>
                      <span className="font-medium">{p.pattern}</span>
                      <span className="text-xs text-muted-foreground">×{p.occurrences} · {p.engines.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreCard({
  icon, label, value, invert,
}: { icon: React.ReactNode; label: string; value: number; invert?: boolean }) {
  const tone = invert
    ? value >= 60 ? 'text-red-600' : value >= 30 ? 'text-orange-600' : 'text-emerald-600'
    : value >= 70 ? 'text-emerald-600' : value >= 40 ? 'text-orange-600' : 'text-red-600';
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
        <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
