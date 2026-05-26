/**
 * Governance Panel · /admin/onboarding-ops (aba Governance)
 *
 * Visualização read-only do registry de governança. NÃO altera nada,
 * apenas mostra: itens, lifecycle, versões, drift, blast radius e doc.
 *
 * Sinais de runtime são opcionais — se ausentes, mostra apenas drifts
 * estruturais. Quando ligarmos sinais reais, basta passar `usage`.
 */
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Filter,
  GitBranch,
  Layers,
  ShieldAlert,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  GOVERNANCE_REGISTRY,
  type GovernanceItem,
  type GovernanceKind,
  type LifecycleState,
  type RiskLevel,
} from '@/lib/onboarding/governanceRegistry';
import {
  analyzeChangeImpact,
  buildGovernanceSummary,
  computeBlastRadius,
  detectDrift,
  generateOperationalDoc,
} from '@/lib/onboarding/governanceAnalysis';

const KIND_LABEL: Record<GovernanceKind, string> = {
  engine: 'Engine',
  threshold: 'Threshold',
  feature_flag: 'Feature Flag',
  heuristic: 'Heurística',
  experiment_constraint: 'Exp. Constraint',
  incident_rule: 'Incident Rule',
  health_score: 'Health Score',
  telemetry_contract: 'Telemetria',
  rpc: 'RPC',
  dashboard: 'Dashboard',
};

const LIFECYCLE_COLOR: Record<LifecycleState, string> = {
  experimental: 'bg-amber-500/15 text-amber-700 border-amber-300',
  active: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
  stable: 'bg-blue-500/15 text-blue-700 border-blue-300',
  deprecated: 'bg-orange-500/15 text-orange-700 border-orange-300',
  disabled: 'bg-slate-500/15 text-slate-700 border-slate-300',
  archived: 'bg-muted text-muted-foreground border',
};

const RISK_COLOR: Record<RiskLevel, string> = {
  low: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
  medium: 'bg-amber-500/15 text-amber-700 border-amber-300',
  high: 'bg-orange-500/15 text-orange-700 border-orange-300',
  critical: 'bg-destructive/15 text-destructive border-destructive/40',
};

export default function AdminGovernancePanel() {
  const [kindFilter, setKindFilter] = useState<'all' | GovernanceKind>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | LifecycleState>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return GOVERNANCE_REGISTRY.filter((it) => {
      if (kindFilter !== 'all' && it.kind !== kindFilter) return false;
      if (lifecycleFilter !== 'all' && it.lifecycle !== lifecycleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!it.id.toLowerCase().includes(q) && !it.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [kindFilter, lifecycleFilter, search]);

  // Drift estrutural (sem sinais de runtime — quando ligarmos, passamos `usage`).
  const drift = useMemo(() => detectDrift({ usage: {} }), []);
  const summary = useMemo(() => buildGovernanceSummary(drift), [drift]);
  const doc = useMemo(() => generateOperationalDoc(), []);
  const selected = selectedId ? GOVERNANCE_REGISTRY.find((it) => it.id === selectedId) : null;
  const blast = selected ? computeBlastRadius(selected.id) : null;
  const impact = selected ? analyzeChangeImpact(selected.id, 'disable') : null;

  return (
    <div className="space-y-4">
      {/* SUMMARY HEADER */}
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard icon={<Layers className="h-4 w-4" />} label="Itens registrados" value={GOVERNANCE_REGISTRY.length} />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Em estado ativo" value={summary.by_lifecycle.active || 0} />
        <SummaryCard icon={<ShieldAlert className="h-4 w-4 text-orange-600" />} label="Alto risco" value={summary.top_risk.length} />
        <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Drifts detectados" value={summary.drift_count} />
      </div>

      <Tabs defaultValue="registry" className="space-y-3">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="registry" className="gap-1"><Layers className="h-4 w-4" /> Registry</TabsTrigger>
          <TabsTrigger value="drift" className="gap-1"><AlertTriangle className="h-4 w-4" /> Drift</TabsTrigger>
          <TabsTrigger value="impact" className="gap-1"><Workflow className="h-4 w-4" /> Blast Radius</TabsTrigger>
          <TabsTrigger value="doc" className="gap-1"><BookOpen className="h-4 w-4" /> Documentação</TabsTrigger>
        </TabsList>

        {/* REGISTRY */}
        <TabsContent value="registry" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Filtros</CardTitle>
              <CardDescription className="text-xs">Lista determinística do registry. Sem mutação.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-3">
              <div className="relative">
                <Filter className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar id/título…" className="pl-8" />
              </div>
              <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {(Object.keys(KIND_LABEL) as GovernanceKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={lifecycleFilter} onValueChange={(v) => setLifecycleFilter(v as any)}>
                <SelectTrigger><SelectValue placeholder="Lifecycle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {(['experimental','active','stable','deprecated','disabled','archived'] as LifecycleState[]).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Lifecycle</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{it.title}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{it.id}</div>
                      </TableCell>
                      <TableCell className="text-xs">{KIND_LABEL[it.kind]}</TableCell>
                      <TableCell className="font-mono text-xs">v{it.version}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={LIFECYCLE_COLOR[it.lifecycle]}>{it.lifecycle}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={RISK_COLOR[it.risk_level]}>{it.risk_level}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedId(it.id)}>
                          <Workflow className="mr-1 h-3.5 w-3.5" /> Impacto
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Sem itens nesse filtro.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DRIFT */}
        <TabsContent value="drift" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Alertas de drift estrutural</CardTitle>
              <CardDescription className="text-xs">
                Detecção sem sinais de runtime — quando ligarmos `usage`, surgem flags órfãs, RPCs sem chamada, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {drift.length === 0 ? (
                <div className="px-6 pb-6 text-sm text-muted-foreground">
                  Nenhum drift estrutural detectado. Registry consistente.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drift.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{d.kind}</TableCell>
                        <TableCell className="font-mono text-xs">{d.item_id}</TableCell>
                        <TableCell><Badge variant="outline" className={RISK_COLOR[d.severity]}>{d.severity}</Badge></TableCell>
                        <TableCell className="text-xs">{d.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IMPACT */}
        <TabsContent value="impact" className="space-y-3">
          {!selected ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Selecione um item no Registry para simular blast radius.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4" /> Impacto se desligar: {selected.title}
                </CardTitle>
                <CardDescription className="text-xs font-mono">{selected.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={RISK_COLOR[impact!.estimated_risk]}>
                    Risco estimado: {impact!.estimated_risk}
                  </Badge>
                  <Badge variant="outline">Itens afetados: {blast!.impacted.length}</Badge>
                  <Badge variant="outline">{impact!.reversible ? 'Reversível' : 'Irreversível'}</Badge>
                </div>
                {impact!.observability_loss.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Perda de observabilidade</div>
                    <ul className="ml-4 list-disc text-sm">
                      {impact!.observability_loss.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                )}
                {blast!.impacted.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Itens dependentes (blast radius)</div>
                    <ul className="ml-4 list-disc text-xs font-mono">
                      {blast!.impacted.map((it) => (
                        <li key={it.id}>{it.id} <span className="text-muted-foreground">· {it.lifecycle}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {impact!.affected_consumers.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Consumidores</div>
                    <ul className="ml-4 list-disc text-xs font-mono">
                      {impact!.affected_consumers.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                )}
                <Button size="sm" variant="outline" onClick={() => setSelectedId(null)}>Limpar seleção</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DOC */}
        <TabsContent value="doc" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4" /> {doc.title}
              </CardTitle>
              <CardDescription className="text-xs">Gerado em {new Date(doc.generated_at).toLocaleString('pt-BR')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {doc.sections.map((sec) => (
                <div key={sec.heading}>
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <GitBranch className="h-3.5 w-3.5" /> {sec.heading}
                  </div>
                  <ul className="ml-4 list-disc text-xs">
                    {sec.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Camada <strong>informacional</strong>. Nenhuma ação é executada a partir desta tela — auto-delete, auto-refactor
        e auto-migration são proibidos por design.
      </p>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md border bg-muted/40 p-2">{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
