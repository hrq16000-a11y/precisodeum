/**
 * Admin Self-Audit Panel · READ-ONLY
 *
 * Visualiza o relatório do `auditConsistency()`. Não executa ações, não
 * modifica dados. Permite simular Change Risk para mudanças propostas.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck, Activity, GitBranch, Workflow } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  analyzeChangeRisk,
  auditConsistency,
  type AuditFinding,
  type AuditSeverity,
  type ChangeRiskReport,
} from '@/lib/onboarding/selfAudit';
import { GOVERNANCE_REGISTRY, type GovernanceKind } from '@/lib/onboarding/governanceRegistry';

const SEV_TONE: Record<AuditSeverity, string> = {
  info: 'bg-muted text-muted-foreground',
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export default function AdminSelfAuditPanel() {
  const [severity, setSeverity] = useState<AuditSeverity | 'all'>('all');
  const [proposal, setProposal] = useState<{ kind: GovernanceKind; targetId: string }>({
    kind: 'threshold',
    targetId: GOVERNANCE_REGISTRY.find((i) => i.kind === 'threshold')?.id ?? GOVERNANCE_REGISTRY[0]?.id ?? '',
  });

  const report = useMemo(() => auditConsistency(), []);
  const risk: ChangeRiskReport = useMemo(
    () => analyzeChangeRisk({ kind: proposal.kind, targetId: proposal.targetId || undefined }),
    [proposal],
  );

  const filtered: AuditFinding[] = useMemo(() => {
    if (severity === 'all') return report.findings;
    return report.findings.filter((f) => f.severity === severity);
  }, [report, severity]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Self-Audit · Arquitetura & Consistência
          </CardTitle>
          <CardDescription>
            Camada read-only. Detecta drift, ciclos, paridade SQL/TS, dashboards sem dados e debt
            operacional. Nunca executa correções.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Kpi label="Itens governados" value={report.totals.items} icon={<Workflow className="h-4 w-4" />} />
          <Kpi label="Findings" value={report.totals.findings} icon={<AlertTriangle className="h-4 w-4" />} />
          <Kpi
            label="Debt score"
            value={`${report.debt.normalized} (${report.debt.band})`}
            icon={<Activity className="h-4 w-4" />}
          />
          <Kpi
            label="Risco arquitetural"
            value={`${report.risk.score} (${report.risk.band})`}
            icon={<GitBranch className="h-4 w-4" />}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="findings" className="space-y-3">
        <TabsList>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="debt">Debt</TabsTrigger>
          <TabsTrigger value="risk">Change Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Severidade</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground ml-auto">
              Gerado em {new Date(report.generated_at).toLocaleString('pt-BR')}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Detalhe</TableHead>
                    <TableHead>Recomendação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                        Nenhum finding nesta severidade.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((f, i) => (
                    <TableRow key={`${f.code}-${f.itemId}-${i}`}>
                      <TableCell><Badge className={SEV_TONE[f.severity]}>{f.severity}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{f.code}</TableCell>
                      <TableCell className="font-mono text-xs">{f.itemId ?? '—'}</TableCell>
                      <TableCell className="text-sm">{f.message}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{f.recommendation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debt" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contributors do Debt</CardTitle>
              <CardDescription>
                Pesos por código de finding × severidade. Banda: {report.debt.band}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Ocorrências</TableHead>
                    <TableHead className="text-right">Peso acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.debt.contributors.map((c) => (
                    <TableRow key={c.code}>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                      <TableCell className="text-right">{c.weight}</TableCell>
                    </TableRow>
                  ))}
                  {report.debt.contributors.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Sem debt acumulado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Change Risk Analyzer</CardTitle>
              <CardDescription>
                Simula impacto de alterar um item: blast radius, debt potencial e impacto de observabilidade.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de mudança</Label>
                  <Select
                    value={proposal.kind}
                    onValueChange={(v) => setProposal((p) => ({ ...p, kind: v as GovernanceKind }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['engine','threshold','feature_flag','heuristic','experiment_constraint','incident_rule','health_score','telemetry_contract','rpc','dashboard'] as GovernanceKind[]).map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Alvo (id do registry)</Label>
                  <Input
                    value={proposal.targetId}
                    onChange={(e) => setProposal((p) => ({ ...p, targetId: e.target.value }))}
                    placeholder="ex.: engine.regression_detector"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Kpi label="Blast radius" value={risk.blastRadius} />
                <Kpi label="Debt potencial" value={risk.debtPotential} />
                <Kpi label="Observabilidade" value={risk.observabilityImpact} />
              </div>
              <div className="text-sm">
                <div className="font-medium mb-1">Dependentes afetados</div>
                {risk.affectedDependents.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nenhum dependente direto/indireto.</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {risk.affectedDependents.map((d) => (
                      <Badge key={d} variant="secondary" className="font-mono text-xs">{d}</Badge>
                    ))}
                  </div>
                )}
              </div>
              {risk.notes.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                  {risk.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
              <Button variant="outline" size="sm" disabled className="opacity-60">
                Aplicar mudança (desabilitado · sistema é read-only)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
