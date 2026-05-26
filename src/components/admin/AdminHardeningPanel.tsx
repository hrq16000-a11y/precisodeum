/**
 * Admin · Runtime Hardening Panel (read-only, opt-in)
 *
 * Visualiza simulações DETERMINÍSTICAS de cenários hostis para o onboarding.
 * Nenhum efeito sobre o onboarding real. Toda execução é in-memory.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldAlert,
  Zap,
  WifiOff,
  RotateCw,
  Layers,
  Split,
  Activity,
  Network,
  Sparkles,
} from 'lucide-react';
import {
  runAllScenarios,
  type HardeningReport,
  type HardeningFinding,
} from '@/lib/onboarding/runtimeHardening';

function severityVariant(s: HardeningFinding['severity']) {
  switch (s) {
    case 'critical':
      return 'destructive' as const;
    case 'high':
      return 'destructive' as const;
    case 'medium':
      return 'default' as const;
    default:
      return 'secondary' as const;
  }
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? 'text-emerald-600' : value >= 60 ? 'text-amber-600' : 'text-rose-600';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl ${tone}`}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function FindingsTable({ findings }: { findings: HardeningFinding[] }) {
  if (findings.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum achado relevante.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Severidade</TableHead>
          <TableHead>Cenário</TableHead>
          <TableHead>Detalhe</TableHead>
          <TableHead>Evidências</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.map((f, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono text-xs">{f.type}</TableCell>
            <TableCell>
              <Badge variant={severityVariant(f.severity)}>{f.severity}</Badge>
            </TableCell>
            <TableCell className="text-xs">{f.scenario ?? '—'}</TableCell>
            <TableCell className="text-xs">{f.detail}</TableCell>
            <TableCell className="text-xs">{f.evidence_count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AdminHardeningPanel() {
  const [seed, setSeed] = useState<string>('42');
  const [report, setReport] = useState<HardeningReport | null>(null);

  const run = () => {
    const parsed = Number(seed) || 42;
    setReport(runAllScenarios({ seed: parsed, session_id: `hardening-${parsed}` }));
  };

  const filteredByGroup = useMemo(() => {
    if (!report) return {} as Record<string, HardeningFinding[]>;
    const groups: Record<string, HardeningFinding[]> = {
      chaos: [],
      recovery: [],
      offline: [],
      retry: [],
      concurrency: [],
      fragmentation: [],
    };
    for (const f of report.findings) {
      if (['retry_storm', 'duplicate_persist'].includes(f.type)) groups.retry.push(f);
      if (['recovery_failure', 'recovery_loop'].includes(f.type)) groups.recovery.push(f);
      if (['telemetry_loss', 'telemetry_delay'].includes(f.type)) groups.offline.push(f);
      if (['cross_tab_conflict'].includes(f.type)) groups.concurrency.push(f);
      if (['hydration_race', 'missing_anchor'].includes(f.type)) groups.fragmentation.push(f);
      if (['phantom_success', 'partial_persist', 'out_of_order'].includes(f.type)) groups.chaos.push(f);
    }
    return groups;
  }, [report]);

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Camada de validação hostil — opt-in, fail-soft, determinística</AlertTitle>
        <AlertDescription>
          Esta aba executa <strong>simulações in-memory</strong> de cenários hostis (offline, packet loss, multi-tab, retry
          storm). Nenhum efeito sobre o onboarding real. Flags default OFF:{' '}
          <code className="text-xs">onboarding_runtime_hardening_enabled</code>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Executar simulação
          </CardTitle>
          <CardDescription>Reprodutível por seed. Todo o output é determinístico.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="hardening-seed">Seed</Label>
            <Input
              id="hardening-seed"
              className="w-32"
              value={seed}
              onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <Button onClick={run} className="gap-2">
            <Zap className="h-4 w-4" /> Rodar 16 cenários
          </Button>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <ScoreCard label="Runtime Resilience" value={report.scores.runtime_resilience} />
            <ScoreCard label="Recovery" value={report.scores.recovery_resilience} />
            <ScoreCard label="Telemetry" value={report.scores.telemetry_resilience} />
            <ScoreCard label="Persistence" value={report.scores.persistence_resilience} />
            <ScoreCard label="Forensic" value={report.scores.forensic_reliability} />
            <ScoreCard label="Chaos Resistance" value={report.scores.chaos_resistance} />
          </div>

          <Tabs defaultValue="chaos" className="space-y-3">
            <TabsList className="flex flex-wrap gap-1">
              <TabsTrigger value="chaos" className="gap-1"><Activity className="h-4 w-4" /> Chaos</TabsTrigger>
              <TabsTrigger value="recovery" className="gap-1"><RotateCw className="h-4 w-4" /> Recovery</TabsTrigger>
              <TabsTrigger value="offline" className="gap-1"><WifiOff className="h-4 w-4" /> Offline</TabsTrigger>
              <TabsTrigger value="retry" className="gap-1"><RotateCw className="h-4 w-4" /> Retry</TabsTrigger>
              <TabsTrigger value="concurrency" className="gap-1"><Split className="h-4 w-4" /> Concurrency</TabsTrigger>
              <TabsTrigger value="fragmentation" className="gap-1"><Layers className="h-4 w-4" /> Fragmentation</TabsTrigger>
              <TabsTrigger value="propagation" className="gap-1"><Network className="h-4 w-4" /> Failure Propagation</TabsTrigger>
              <TabsTrigger value="integrity" className="gap-1"><ShieldAlert className="h-4 w-4" /> Runtime Integrity</TabsTrigger>
            </TabsList>

            {(['chaos', 'recovery', 'offline', 'retry', 'concurrency', 'fragmentation'] as const).map((g) => (
              <TabsContent key={g} value={g} className="space-y-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base capitalize">{g}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FindingsTable findings={filteredByGroup[g] ?? []} />
                  </CardContent>
                </Card>
              </TabsContent>
            ))}

            <TabsContent value="propagation" className="space-y-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Failure Propagation</CardTitle>
                  <CardDescription>
                    {report.graph.nodes.length} nós · {report.graph.edges.length} arestas ·{' '}
                    {report.graph.cascades.length} cascatas detectadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Nós</p>
                      <div className="flex flex-wrap gap-1">
                        {report.graph.nodes.slice(0, 40).map((n) => (
                          <Badge key={n.id} variant="outline" className="text-xs">
                            {n.kind}:{n.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Arestas</p>
                      <div className="flex flex-wrap gap-1">
                        {report.graph.edges.slice(0, 40).map((e, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {e.kind}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrity" className="space-y-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Runtime Integrity · todos os achados</CardTitle>
                  <CardDescription>{report.findings.length} achados em 16 cenários</CardDescription>
                </CardHeader>
                <CardContent>
                  <FindingsTable findings={report.findings} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
