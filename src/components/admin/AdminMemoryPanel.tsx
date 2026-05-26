/**
 * AdminMemoryPanel · aba "Memory" em /admin/onboarding-ops
 *
 * Painel read-only que materializa a camada de Operational Memory a partir
 * de `onboarding_events` recentes (regression + reality), mapeando-os para
 * `HistoricalIncident` e exibindo recurring patterns, hotspots crônicos,
 * release instability, scores, blast radius e summaries determinísticos.
 *
 * SEM realtime, SEM PII, SEM mutação.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, GitBranch, History, LineChart, Network,
  Radar, RefreshCcw, Repeat, ShieldAlert, Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import {
  buildOperationalMemoryReport,
  type HistoricalIncident,
  type IncidentDetectorKind,
  type Severity,
} from '@/lib/onboarding/operationalMemory';

interface Props { enabled: boolean }

const DETECTOR_MAP: Record<string, IncidentDetectorKind> = {
  onboarding_regression_detected: 'release_regression',
  phantom_success: 'phantom_success',
  partial_persistence: 'partial_persistence',
  zombie_draft: 'zombie_draft',
  hidden_loop: 'hidden_loop',
  retry_storm: 'retry_storm',
  dead_navigation: 'dead_navigation',
  toast_vs_reality: 'toast_vs_reality',
  ui_vs_backend_divergence: 'ui_vs_backend_divergence',
  impossible_state: 'impossible_state',
  session_fragmentation: 'session_fragmentation',
  recovery_corrupted: 'recovery_integrity_failure',
  recovery_integrity_failure: 'recovery_integrity_failure',
  persist_failed: 'persistence_failure',
  autosave_failed: 'autosave_failure',
  validation_failed: 'behavioral_friction',
};

function mapEventToIncident(row: {
  id: string;
  created_at: string;
  phase: string | null;
  event: string;
  meta: Record<string, unknown> | null;
}): HistoricalIncident | null {
  const detector = DETECTOR_MAP[row.event];
  if (!detector) return null;
  const meta = row.meta ?? {};
  const sev = (meta as any).severity as Severity | undefined;
  return {
    id: row.id,
    detector,
    phase: row.phase,
    transition: null,
    retry_pattern: 'none',
    recovery_pattern: row.event.startsWith('recovery_') ? 'corrupted' : 'none',
    release: ((meta as any).app_version ?? null) as string | null,
    device_class: ((meta as any).device_class ?? 'unknown') as 'mobile' | 'desktop' | 'unknown',
    timing_bucket: 'medium',
    severity: sev ?? (detector === 'phantom_success' || detector === 'impossible_state' ? 'critical' : 'high'),
    divergence_chain: [],
    occurred_at: row.created_at,
    mitigation_id: null,
  };
}

function Score({ label, value }: { label: string; value: number }) {
  const tone = value >= 80
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : value >= 60
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : 'bg-red-100 text-red-800 border-red-300';
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function AdminMemoryPanel({ enabled }: Props) {
  const [days, setDays] = useState(30);

  const query = useQuery({
    queryKey: ['admin', 'memory', 'incidents', days],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const sb = supabase as any;
      const { data, error } = await sb
        .from('onboarding_events')
        .select('id, created_at, phase, event, meta')
        .in('event', Object.keys(DETECTOR_MAP))
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        created_at: string;
        phase: string | null;
        event: string;
        meta: Record<string, unknown> | null;
      }>;
    },
  });

  const report = useMemo(() => {
    const rows = query.data ?? [];
    const incidents = rows.map(mapEventToIncident).filter((x): x is HistoricalIncident => !!x);
    return buildOperationalMemoryReport(incidents);
  }, [query.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" /> Operational Memory · Knowledge Layer
        </CardTitle>
        <CardDescription>
          Conhecimento operacional acumulado a partir de incidentes históricos. Sem IA, sem ML, sem PII —
          tudo determinístico, auditável e versionado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">Janela</Label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
            </SelectContent>
          </Select>
          {query.isLoading && <span className="text-xs text-muted-foreground">Carregando…</span>}
          <span className="text-xs text-muted-foreground">
            {query.data?.length ?? 0} eventos · {report.failure_memory.length} fingerprints
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Score label="Reputation" value={report.scores.operational_reputation} />
          <Score label="Stability" value={report.scores.runtime_stability} />
          <Score label="Persistence" value={report.scores.persistence_reliability} />
          <Score label="Recovery" value={report.scores.recovery_reliability} />
          <Score label="Release" value={report.scores.release_stability} />
        </div>

        <Tabs defaultValue="summary" className="space-y-3">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="summary" className="gap-1"><Sparkles className="h-4 w-4" /> Summary</TabsTrigger>
            <TabsTrigger value="families" className="gap-1"><Repeat className="h-4 w-4" /> Recurrence</TabsTrigger>
            <TabsTrigger value="hotspots" className="gap-1"><Radar className="h-4 w-4" /> Hotspots</TabsTrigger>
            <TabsTrigger value="releases" className="gap-1"><GitBranch className="h-4 w-4" /> Releases</TabsTrigger>
            <TabsTrigger value="blast" className="gap-1"><ShieldAlert className="h-4 w-4" /> Blast Radius</TabsTrigger>
            <TabsTrigger value="memory" className="gap-1"><History className="h-4 w-4" /> Failure Memory</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1"><LineChart className="h-4 w-4" /> Timeline</TabsTrigger>
            <TabsTrigger value="drift" className="gap-1"><Activity className="h-4 w-4" /> Drift/Decay</TabsTrigger>
            <TabsTrigger value="graph" className="gap-1"><Network className="h-4 w-4" /> Graph</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-2">
            {!report.summary.length && (
              <p className="text-sm text-muted-foreground">Nenhum padrão histórico relevante na janela.</p>
            )}
            {report.summary.map((s, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border p-3">
                <Badge variant="outline" className="text-[10px]">{s.kind}</Badge>
                <span className="text-sm">{s.text}</span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="families">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Family</TableHead>
                  <TableHead>Fingerprint</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Releases</TableHead>
                  <TableHead>Phases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.recurring.map((r) => (
                  <TableRow key={r.fingerprint}>
                    <TableCell><Badge variant="outline">{r.family}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.fingerprint}</TableCell>
                    <TableCell className="tabular-nums">{r.count}</TableCell>
                    <TableCell className="text-xs">{r.affected_releases.join(', ') || '—'}</TableCell>
                    <TableCell className="text-xs">{r.affected_phases.join(', ') || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="hotspots">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Phase</TableHead><TableHead>Count</TableHead><TableHead>Ratio</TableHead><TableHead>Families</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {report.hotspots.map((h) => (
                  <TableRow key={h.phase}>
                    <TableCell>{h.phase}</TableCell>
                    <TableCell className="tabular-nums">{h.count}</TableCell>
                    <TableCell className="tabular-nums">{h.ratio_vs_global}x</TableCell>
                    <TableCell className="text-xs">{h.families.join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="releases">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Release</TableHead><TableHead>Incidents</TableHead><TableHead>Ratio</TableHead><TableHead>Blast</TableHead><TableHead>Families</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {report.releases.map((r) => (
                  <TableRow key={r.release}>
                    <TableCell className="font-mono">{r.release}</TableCell>
                    <TableCell className="tabular-nums">{r.incidents}</TableCell>
                    <TableCell className="tabular-nums">{r.ratio_vs_avg}x</TableCell>
                    <TableCell className="tabular-nums">{r.blast_radius_score}</TableCell>
                    <TableCell className="text-xs">{r.families.join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="blast">
            <Table>
              <TableHeader><TableRow><TableHead>Release</TableHead><TableHead>Incidentes</TableHead><TableHead>Blast Score</TableHead></TableRow></TableHeader>
              <TableBody>
                {report.blast_history.map((p) => (
                  <TableRow key={p.release}>
                    <TableCell className="font-mono">{p.release}</TableCell>
                    <TableCell className="tabular-nums">{p.incidents}</TableCell>
                    <TableCell className="tabular-nums">{p.blast}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="memory">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fingerprint</TableHead><TableHead>Family</TableHead>
                  <TableHead>Count</TableHead><TableHead>First</TableHead><TableHead>Last</TableHead>
                  <TableHead>Blast</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.failure_memory.slice(0, 50).map((m) => (
                  <TableRow key={m.fingerprint}>
                    <TableCell className="font-mono text-xs">{m.fingerprint}</TableCell>
                    <TableCell><Badge variant="outline">{m.family}</Badge></TableCell>
                    <TableCell className="tabular-nums">{m.recurrence_count}</TableCell>
                    <TableCell className="text-xs">{m.first_seen.slice(0, 16).replace('T', ' ')}</TableCell>
                    <TableCell className="text-xs">{m.last_seen.slice(0, 16).replace('T', ' ')}</TableCell>
                    <TableCell className="tabular-nums">{m.blast_radius}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="timeline">
            <div className="max-h-80 space-y-1 overflow-auto rounded-md border p-2">
              {report.timeline.map((p) => (
                <div key={p.date} className="flex items-center justify-between text-xs">
                  <span className="font-mono">{p.date}</span>
                  <span className="tabular-nums">{p.incidents} inc · sev={p.severity_score}</span>
                </div>
              ))}
              {!report.timeline.length && <p className="text-sm text-muted-foreground">Sem eventos.</p>}
            </div>
          </TabsContent>

          <TabsContent value="drift" className="space-y-3">
            <div className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" /> <strong>Drift operacional:</strong>
                <Badge variant="outline">{Math.round(report.drift.drift * 100)}%</Badge>
                {!report.drift.enough_sample && <span className="text-xs text-muted-foreground">amostra insuficiente</span>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> <strong>Stability decay:</strong>
                <Badge variant={report.decay.decaying ? 'destructive' : 'outline'}>
                  {report.decay.decaying ? 'em queda' : 'estável'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  recente {report.decay.recent_per_day}/dia · baseline {report.decay.baseline_per_day}/dia
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <strong>Trend:</strong>
                <Badge variant="outline">{report.trend.trend}</Badge>
                <span className="text-xs text-muted-foreground">Δ {report.trend.delta_per_day}/dia</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="graph">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-medium">Nodes ({report.graph.nodes.length})</h4>
                <div className="max-h-72 space-y-1 overflow-auto rounded-md border p-2 text-xs">
                  {report.graph.nodes.slice(0, 200).map((n) => (
                    <div key={n.id} className="flex items-center justify-between">
                      <span className="font-mono">{n.label}</span>
                      <Badge variant="outline" className="text-[10px]">{n.kind}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium">Edges ({report.graph.edges.length})</h4>
                <div className="max-h-72 space-y-1 overflow-auto rounded-md border p-2 text-xs">
                  {report.graph.edges.slice(0, 200).map((e, i) => (
                    <div key={i}>
                      <span className="font-mono">{e.from}</span> → <span className="font-mono">{e.to}</span>{' '}
                      <Badge variant="outline" className="text-[10px]">{e.kind} ×{e.weight}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
