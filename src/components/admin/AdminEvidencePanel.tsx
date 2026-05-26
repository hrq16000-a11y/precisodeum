/**
 * Admin · Evidence Correlation Panel
 *
 * Lê `onboarding_events` (mesmo padrão da RuntimeGovernance) e renderiza a
 * malha de evidência: lineage, truth score, coverage, findings e audit.
 *
 * READ-ONLY. Sem mutações.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, Eye, EyeOff, Network, Radar, ShieldQuestion, Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import type { RuntimeEvent } from '@/lib/onboarding/runtimeGovernance';
import {
  buildEvidenceReport,
  type EvidenceFinding,
  type RuntimeTruthScore,
  type SignalLineageEntry,
  type CrossLayerAuditEntry,
  type CoverageMatrixEntry,
  type TrustBand,
  type ProvenanceClass,
} from '@/lib/onboarding/evidenceCorrelation';

interface Props {
  enabled: boolean;
}

const BAND_STYLES: Record<TrustBand, string> = {
  high: 'bg-emerald-200 text-emerald-900',
  medium: 'bg-amber-200 text-amber-900',
  low: 'bg-orange-300 text-orange-950',
  unknown: 'bg-slate-200 text-slate-700',
};

const PROVENANCE_STYLES: Record<ProvenanceClass, string> = {
  observed: 'bg-emerald-100 text-emerald-900',
  observed_proxy: 'bg-sky-100 text-sky-900',
  inferred: 'bg-violet-100 text-violet-900',
  declared: 'bg-slate-100 text-slate-800',
  synthetic: 'bg-rose-200 text-rose-950',
  empty: 'bg-slate-200 text-slate-700',
};

const SEV_STYLES: Record<EvidenceFinding['severity'], string> = {
  info: 'bg-slate-200 text-slate-800',
  warning: 'bg-amber-200 text-amber-900',
  critical: 'bg-red-500 text-white',
};

export default function AdminEvidencePanel({ enabled }: Props) {
  const [days, setDays] = useState<number>(14);
  const [search, setSearch] = useState<string>('');

  const eventsQuery = useQuery({
    queryKey: ['admin', 'evidence', 'events', days],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<RuntimeEvent[]> => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('onboarding_events')
        .select('event, phase, created_at, meta')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        event: string; phase: string | null; created_at: string;
        meta: Record<string, unknown> | null;
      }>;
      return rows.map((r) => ({
        item_id: r.phase ? `${r.phase}:${r.event}` : r.event,
        ts: new Date(r.created_at).getTime(),
        is_error: typeof r.meta === 'object' && r.meta !== null && (r.meta as { error?: unknown }).error
          ? true
          : false,
      }));
    },
  });

  const report = useMemo(() => {
    return buildEvidenceReport(eventsQuery.data ?? [], { window_days: days });
  }, [eventsQuery.data, days]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return report;
    const matches = (id: string) => id.toLowerCase().includes(q);
    return {
      ...report,
      lineage: report.lineage.filter((l) => matches(l.item_id)),
      truth: report.truth.filter((t) => matches(t.item_id)),
      findings: report.findings.filter((f) => !f.item_id || matches(f.item_id)),
      audit: report.audit.filter((a) => matches(a.item_id)),
    };
  }, [report, search]);

  const summary = useMemo(() => {
    const total = report.lineage.length;
    const observed = report.lineage.filter((l) => l.provenance === 'observed').length;
    const declared = report.lineage.filter((l) => l.provenance === 'declared').length;
    const empty = report.lineage.filter((l) => l.provenance === 'empty').length;
    const synth = report.lineage.filter((l) => l.provenance === 'synthetic').length;
    const high = report.lineage.filter((l) => l.trust_band === 'high').length;
    return { total, observed, declared, empty, synth, high };
  }, [report.lineage]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="h-4 w-4" /> Runtime Evidence Correlation
            </CardTitle>
            <CardDescription>
              Malha de evidência observada · runtime vs registry · somente leitura.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="ev-days" className="text-xs">Janela</Label>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger id="ev-days" className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 dias</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Filtrar por item_id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
          </div>
        </CardHeader>
        <CardContent>
          {eventsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando sinais…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <Kpi label="Itens" value={summary.total} icon={<Network className="h-3 w-3" />} />
              <Kpi label="Observados" value={summary.observed} icon={<Eye className="h-3 w-3" />} />
              <Kpi label="Apenas declarados" value={summary.declared} icon={<ShieldQuestion className="h-3 w-3" />} />
              <Kpi label="Sem sinal" value={summary.empty} icon={<EyeOff className="h-3 w-3" />} />
              <Kpi label="Sintéticos" value={summary.synth} icon={<AlertTriangle className="h-3 w-3" />} highlight={summary.synth > 0} />
              <Kpi label="Trust alto" value={summary.high} icon={<CheckCircle2 className="h-3 w-3" />} />
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="truth" className="space-y-3">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="truth" className="gap-1"><Sparkles className="h-4 w-4" /> Truth Score</TabsTrigger>
          <TabsTrigger value="lineage" className="gap-1"><Network className="h-4 w-4" /> Lineage</TabsTrigger>
          <TabsTrigger value="findings" className="gap-1"><AlertTriangle className="h-4 w-4" /> Findings</TabsTrigger>
          <TabsTrigger value="coverage" className="gap-1"><Radar className="h-4 w-4" /> Coverage</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1"><ShieldQuestion className="h-4 w-4" /> Cross-layer</TabsTrigger>
        </TabsList>

        <TabsContent value="truth">
          <TruthTable rows={filtered.truth} />
        </TabsContent>
        <TabsContent value="lineage">
          <LineageTable rows={filtered.lineage} />
        </TabsContent>
        <TabsContent value="findings">
          <FindingsTable rows={filtered.findings} />
        </TabsContent>
        <TabsContent value="coverage">
          <CoverageTable rows={filtered.coverage} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTable rows={filtered.audit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  label, value, icon, highlight,
}: { label: string; value: number | string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${highlight ? 'border-red-400 bg-red-50' : ''}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function TruthTable({ rows }: { rows: ReadonlyArray<RuntimeTruthScore> }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.score - a.score), [rows]);
  if (sorted.length === 0) return <Empty label="Sem itens para o filtro atual." />;
  return (
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow>
        <TableHead>Item</TableHead><TableHead>Score</TableHead><TableHead>Trust</TableHead>
        <TableHead>Provenance</TableHead><TableHead>Stale</TableHead><TableHead>Contribuidores</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {sorted.map((t) => (
          <TableRow key={t.item_id}>
            <TableCell className="font-mono text-xs">{t.item_id}</TableCell>
            <TableCell className="font-semibold">{t.score}</TableCell>
            <TableCell><Badge className={BAND_STYLES[t.band]}>{t.band}</Badge></TableCell>
            <TableCell><Badge className={PROVENANCE_STYLES[t.provenance]}>{t.provenance}</Badge></TableCell>
            <TableCell>{t.stale ? <Badge variant="outline">stale</Badge> : '—'}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{t.contributors.join(' · ')}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table></CardContent></Card>
  );
}

function LineageTable({ rows }: { rows: ReadonlyArray<SignalLineageEntry> }) {
  if (rows.length === 0) return <Empty label="Sem lineage para o filtro." />;
  return (
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow>
        <TableHead>Item</TableHead><TableHead>Kind</TableHead>
        <TableHead>Lifecycle</TableHead><TableHead>Provenance</TableHead>
        <TableHead>Confidence</TableHead><TableHead>Sinais</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((l) => (
          <TableRow key={l.item_id}>
            <TableCell className="font-mono text-xs">{l.item_id}</TableCell>
            <TableCell>{l.kind}</TableCell>
            <TableCell>{l.lifecycle}</TableCell>
            <TableCell><Badge className={PROVENANCE_STYLES[l.provenance]}>{l.provenance}</Badge></TableCell>
            <TableCell>{(l.confidence * 100).toFixed(0)}%</TableCell>
            <TableCell className="text-xs">
              {l.signals.map((s, i) => (
                <span key={i} className="mr-1 inline-block rounded bg-slate-100 px-1">
                  {s.source}·{s.quality}{s.sample_size > 0 ? `·n=${s.sample_size}` : ''}
                </span>
              ))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table></CardContent></Card>
  );
}

function FindingsTable({ rows }: { rows: ReadonlyArray<EvidenceFinding> }) {
  if (rows.length === 0) return <Empty label="Nenhuma anomalia detectada." />;
  const sorted = [...rows].sort((a, b) => {
    const w: Record<EvidenceFinding['severity'], number> = { critical: 0, warning: 1, info: 2 };
    return w[a.severity] - w[b.severity];
  });
  return (
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow>
        <TableHead>Severity</TableHead><TableHead>Kind</TableHead>
        <TableHead>Item</TableHead><TableHead>Mensagem</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {sorted.map((f, i) => (
          <TableRow key={i}>
            <TableCell><Badge className={SEV_STYLES[f.severity]}>{f.severity}</Badge></TableCell>
            <TableCell className="font-mono text-xs">{f.kind}</TableCell>
            <TableCell className="font-mono text-xs">{f.item_id ?? '—'}</TableCell>
            <TableCell className="text-xs">{f.message}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table></CardContent></Card>
  );
}

function CoverageTable({ rows }: { rows: ReadonlyArray<CoverageMatrixEntry> }) {
  if (rows.length === 0) return <Empty label="Sem cobertura mapeada." />;
  return (
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow>
        <TableHead>Kind</TableHead><TableHead>Total</TableHead>
        <TableHead>Observado</TableHead><TableHead>Proxy</TableHead>
        <TableHead>Apenas declarado</TableHead><TableHead>Vazio</TableHead>
        <TableHead>Cobertura</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.kind}>
            <TableCell>{c.kind}</TableCell>
            <TableCell>{c.total}</TableCell>
            <TableCell>{c.observed}</TableCell>
            <TableCell>{c.proxy}</TableCell>
            <TableCell>{c.declared_only}</TableCell>
            <TableCell>{c.empty}</TableCell>
            <TableCell>{(c.coverage_ratio * 100).toFixed(0)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table></CardContent></Card>
  );
}

function AuditTable({ rows }: { rows: ReadonlyArray<CrossLayerAuditEntry> }) {
  if (rows.length === 0) return <Empty label="Sem auditoria cross-layer." />;
  const styles: Record<CrossLayerAuditEntry['verdict'], string> = {
    aligned: 'bg-emerald-200 text-emerald-900',
    'over-declared': 'bg-amber-200 text-amber-900',
    'under-declared': 'bg-orange-300 text-orange-950',
    inconsistent: 'bg-red-500 text-white',
  };
  return (
    <Card><CardContent className="p-0"><Table>
      <TableHeader><TableRow>
        <TableHead>Item</TableHead><TableHead>Lifecycle</TableHead>
        <TableHead>Provenance</TableHead><TableHead>Veredicto</TableHead><TableHead>Nota</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((a) => (
          <TableRow key={a.item_id}>
            <TableCell className="font-mono text-xs">{a.item_id}</TableCell>
            <TableCell>{a.lifecycle}</TableCell>
            <TableCell><Badge className={PROVENANCE_STYLES[a.provenance]}>{a.provenance}</Badge></TableCell>
            <TableCell><Badge className={styles[a.verdict]}>{a.verdict}</Badge></TableCell>
            <TableCell className="text-xs">{a.note}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table></CardContent></Card>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{label}</CardContent></Card>
  );
}
