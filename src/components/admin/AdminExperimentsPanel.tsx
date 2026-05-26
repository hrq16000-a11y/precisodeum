/**
 * AdminExperimentsPanel · UI da aba "Experiments" do Onboarding Ops.
 *
 * Lê/escreve apenas via RPCs admin_*. Nunca toca em onboarding ao vivo.
 * - Lista de experimentos + status
 * - Métricas por variante (janela ajustável)
 * - Dialog para criar/editar (whitelist segura de tipos)
 * - Ações: pausar / retomar / completar / rodar kill switch / snapshot
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Beaker, Camera, CheckCircle2, Clock, Pause, Play, Plus,
  RefreshCcw, ShieldAlert, Skull, Trash2, TrendingDown, TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  SAFE_EXPERIMENT_TYPES, computeVariantDelta, validateExperimentDefinition,
  type SafeExperimentType, type VariantMetrics,
} from '@/lib/onboarding/experimentEngine';

type ExperimentRow = {
  id: string; experiment_key: string; name: string; description: string | null;
  type: SafeExperimentType; status: 'draft'|'running'|'paused'|'auto_disabled'|'completed';
  rollout_percentage: number;
  variants: Array<{ id: string; label?: string; weight?: number; isControl?: boolean }>;
  audience: Record<string, unknown>;
  start_at: string | null; end_at: string | null;
  auto_kill_enabled: boolean;
  last_evaluated_at: string | null; last_kill_reason: string | null;
  created_at: string; updated_at: string;
};

const STATUS_COLOR: Record<ExperimentRow['status'], string> = {
  draft: 'bg-slate-200 text-slate-800',
  running: 'bg-emerald-200 text-emerald-900',
  paused: 'bg-amber-200 text-amber-900',
  auto_disabled: 'bg-red-200 text-red-900',
  completed: 'bg-blue-200 text-blue-900',
};

export default function AdminExperimentsPanel({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [hours, setHours] = useState(24);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExperimentRow | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin', 'onb-experiments', 'list'],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_onboarding_experiments' as never);
      if (error) throw error;
      return (data ?? []) as ExperimentRow[];
    },
  });

  const experiments = listQuery.data ?? [];
  const active = useMemo(
    () => selectedKey ? experiments.find(e => e.experiment_key === selectedKey) : experiments[0],
    [experiments, selectedKey]
  );

  const metricsQuery = useQuery({
    queryKey: ['admin', 'onb-experiments', 'metrics', active?.experiment_key, hours],
    enabled: enabled && !!active?.experiment_key,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'admin_experiment_variant_metrics' as never,
        { _experiment_key: active!.experiment_key, _hours: hours } as never,
      );
      if (error) throw error;
      return (data ?? []) as Array<{
        variant_id: string; units_assigned: number; enters: number; completes: number;
        abandons: number; refreshes: number; recoveries: number;
        validation_failed: number; rage_clicks: number; hesitations: number;
      }>;
    },
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { key: string; status: ExperimentRow['status']; reason?: string }) => {
      const { error } = await supabase.rpc(
        'admin_set_onboarding_experiment_status' as never,
        { _experiment_key: vars.key, _status: vars.status, _reason: vars.reason ?? null } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'onb-experiments'] });
      toast({ title: 'Status atualizado' });
    },
    onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
  });

  const snapshot = useMutation({
    mutationFn: async (vars: { key: string; kind: 'baseline'|'running'|'final' }) => {
      const { error } = await supabase.rpc(
        'admin_capture_onboarding_experiment_snapshot' as never,
        { _experiment_key: vars.key, _kind: vars.kind, _hours: hours } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Snapshot capturado' }),
    onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
  });

  const runKillEval = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('evaluate_onboarding_experiments_kill_switch' as never);
      if (error) throw error;
      return data as { disabled_count: number; disabled_keys?: string[]; reason?: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin', 'onb-experiments'] });
      toast({
        title: 'Motor executado',
        description: data.reason ? `Skipped: ${data.reason}` : `Desativados: ${data.disabled_count}`,
      });
    },
    onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
  });

  if (!enabled) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" />
          Faça login como admin para visualizar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho + ações globais */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-4 w-4" /> Experimentos seguros do onboarding
            </CardTitle>
            <CardDescription>
              Apenas tipos visuais (copy, label, CTA, helper, ordem, microinteração). Persistência,
              hydration, autosave e recovery são <strong>proibidos</strong>. Kill switch automático ativo.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2,6,24,72,168].map(h => (
                  <SelectItem key={h} value={String(h)}>Últimas {h}h</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => runKillEval.mutate()} disabled={runKillEval.isPending}>
              <Skull className="mr-1 h-4 w-4" /> Rodar kill switch
            </Button>
            <ExperimentDialog
              open={dialogOpen}
              onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
              editing={editing}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['admin', 'onb-experiments'] });
                setDialogOpen(false); setEditing(null);
              }}
              trigger={
                <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                  <Plus className="mr-1 h-4 w-4" /> Novo experimento
                </Button>
              }
            />
          </div>
        </CardHeader>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Experimentos cadastrados ({experiments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : experiments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum experimento. Crie o primeiro acima.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Chave</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rollout</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead>Última avaliação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {experiments.map(exp => (
                  <TableRow
                    key={exp.id}
                    data-active={active?.experiment_key === exp.experiment_key}
                    className="data-[active=true]:bg-muted/40"
                  >
                    <TableCell>
                      <button
                        className="text-left font-mono text-xs hover:underline"
                        onClick={() => setSelectedKey(exp.experiment_key)}
                      >
                        {exp.experiment_key}
                      </button>
                      <div className="text-[10px] text-muted-foreground">{exp.name}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{exp.type}</Badge></TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[exp.status]}>{exp.status}</Badge>
                      {exp.last_kill_reason && (
                        <div className="mt-1 text-[10px] text-red-700">{exp.last_kill_reason}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{exp.rollout_percentage}%</TableCell>
                    <TableCell className="text-xs">{exp.variants?.length ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {exp.last_evaluated_at
                        ? new Date(exp.last_evaluated_at).toLocaleString('pt-BR')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {exp.status !== 'running' && (
                          <Button size="sm" variant="outline"
                            onClick={() => setStatus.mutate({ key: exp.experiment_key, status: 'running' })}>
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        {exp.status === 'running' && (
                          <Button size="sm" variant="outline"
                            onClick={() => setStatus.mutate({ key: exp.experiment_key, status: 'paused' })}>
                            <Pause className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline"
                          onClick={() => setStatus.mutate({ key: exp.experiment_key, status: 'completed' })}>
                          <CheckCircle2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => { setEditing(exp); setDialogOpen(true); }}>
                          editar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detalhe / métricas por variante */}
      {active && (
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-sm">
                Métricas · <span className="font-mono">{active.experiment_key}</span>
              </CardTitle>
              <CardDescription>
                Janela: últimas {hours}h · status: {active.status} · auto-kill:{' '}
                {active.auto_kill_enabled ? 'on' : 'off'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => snapshot.mutate({ key: active.experiment_key, kind: 'baseline' })}>
                <Camera className="mr-1 h-3 w-3" /> Baseline
              </Button>
              <Button size="sm" variant="outline" onClick={() => snapshot.mutate({ key: active.experiment_key, kind: 'running' })}>
                <Camera className="mr-1 h-3 w-3" /> Running
              </Button>
              <Button size="sm" variant="outline" onClick={() => snapshot.mutate({ key: active.experiment_key, kind: 'final' })}>
                <Camera className="mr-1 h-3 w-3" /> Final
              </Button>
              <Button size="sm" variant="ghost" onClick={() => metricsQuery.refetch()}>
                <RefreshCcw className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <VariantsTable
              metrics={(metricsQuery.data ?? []) as VariantMetricsRow[]}
              variants={active.variants}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- VariantsTable ------------------------------------------------

type VariantMetricsRow = {
  variant_id: string; units_assigned: number; enters: number; completes: number;
  abandons: number; refreshes: number; recoveries: number;
  validation_failed: number; rage_clicks: number; hesitations: number;
};

function toVm(r: VariantMetricsRow): VariantMetrics {
  return {
    variantId: r.variant_id,
    unitsAssigned: Number(r.units_assigned) || 0,
    enters: Number(r.enters) || 0,
    completes: Number(r.completes) || 0,
    abandons: Number(r.abandons) || 0,
    refreshes: Number(r.refreshes) || 0,
    recoveries: Number(r.recoveries) || 0,
    validationFailed: Number(r.validation_failed) || 0,
    rageClicks: Number(r.rage_clicks) || 0,
    hesitations: Number(r.hesitations) || 0,
    avgPhaseDurationMs: 0,
  };
}

function VariantsTable({
  metrics,
  variants,
}: { metrics: VariantMetricsRow[]; variants: ExperimentRow['variants'] }) {
  const controlDef = variants?.find(v => v.isControl);
  const controlMetricsRow = metrics.find(m => m.variant_id === controlDef?.id);
  const controlVm = controlMetricsRow ? toVm(controlMetricsRow) : null;

  if (metrics.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem dados de variantes ainda nesta janela.</p>;
  }

  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Variante</TableHead>
        <TableHead className="text-right">Units</TableHead>
        <TableHead className="text-right">Enters</TableHead>
        <TableHead className="text-right">Compl.</TableHead>
        <TableHead className="text-right">Aband.</TableHead>
        <TableHead className="text-right">Val. fail</TableHead>
        <TableHead className="text-right">Rage</TableHead>
        <TableHead className="text-right">Δ Compl. (pp)</TableHead>
        <TableHead>Status</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {metrics.map(r => {
          const isControl = r.variant_id === controlDef?.id;
          const vm = toVm(r);
          const delta = controlVm && !isControl ? computeVariantDelta(vm, controlVm) : null;
          return (
            <TableRow key={r.variant_id}>
              <TableCell className="font-mono text-xs">
                {r.variant_id}{isControl && <Badge variant="outline" className="ml-1">control</Badge>}
              </TableCell>
              <TableCell className="text-right">{r.units_assigned}</TableCell>
              <TableCell className="text-right">{r.enters}</TableCell>
              <TableCell className="text-right">{r.completes}</TableCell>
              <TableCell className="text-right">{r.abandons}</TableCell>
              <TableCell className="text-right">{r.validation_failed}</TableCell>
              <TableCell className="text-right">{r.rage_clicks}</TableCell>
              <TableCell className="text-right">
                {delta ? (
                  <span className={
                    delta.completionRatePp > 0 ? 'font-semibold text-emerald-700'
                    : delta.completionRatePp < 0 ? 'font-semibold text-red-700' : ''
                  }>
                    {delta.completionRatePp > 0 ? '+' : ''}{delta.completionRatePp}
                  </span>
                ) : '—'}
              </TableCell>
              <TableCell>
                {delta ? (
                  <Badge variant="outline" className={
                    delta.status === 'winning' ? 'border-emerald-400 text-emerald-700'
                    : delta.status === 'losing' ? 'border-red-400 text-red-700'
                    : 'text-muted-foreground'
                  }>
                    {delta.status === 'winning' && <TrendingUp className="mr-1 h-3 w-3" />}
                    {delta.status === 'losing' && <TrendingDown className="mr-1 h-3 w-3" />}
                    {delta.status} · {delta.confidence}
                  </Badge>
                ) : <Badge variant="outline">baseline</Badge>}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ---------- Dialog -------------------------------------------------------

function ExperimentDialog({
  open, onOpenChange, editing, onSaved, trigger,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ExperimentRow | null;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const { toast } = useToast();
  const [key, setKey] = useState(editing?.experiment_key ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [type, setType] = useState<SafeExperimentType>(editing?.type ?? 'cta_wording');
  const [rollout, setRollout] = useState<number>(editing?.rollout_percentage ?? 10);
  const [variantsJson, setVariantsJson] = useState<string>(
    JSON.stringify(editing?.variants ?? [
      { id: 'control', label: 'Control', isControl: true, weight: 1 },
      { id: 'b', label: 'Variant B', weight: 1 },
    ], null, 2)
  );
  const [audienceJson, setAudienceJson] = useState<string>(
    JSON.stringify(editing?.audience ?? {}, null, 2)
  );
  const [autoKill, setAutoKill] = useState<boolean>(editing?.auto_kill_enabled ?? true);

  // sync quando muda editing
  useMemo(() => {
    if (editing) {
      setKey(editing.experiment_key); setName(editing.name);
      setDescription(editing.description ?? ''); setType(editing.type);
      setRollout(editing.rollout_percentage);
      setVariantsJson(JSON.stringify(editing.variants, null, 2));
      setAudienceJson(JSON.stringify(editing.audience, null, 2));
      setAutoKill(editing.auto_kill_enabled);
    }
  }, [editing]);

  const save = useMutation({
    mutationFn: async () => {
      let variants: unknown; let audience: unknown;
      try { variants = JSON.parse(variantsJson); }
      catch { throw new Error('Variants: JSON inválido'); }
      try { audience = JSON.parse(audienceJson || '{}'); }
      catch { throw new Error('Audience: JSON inválido'); }
      const v = validateExperimentDefinition({
        id: key, type, rolloutPercentage: rollout,
        variants: variants as never, status: 'draft',
      });
      if (!v.ok) throw new Error('Validação: ' + v.errors.join(', '));
      const { error } = await supabase.rpc(
        'admin_upsert_onboarding_experiment' as never,
        {
          _experiment_key: key, _name: name, _type: type,
          _rollout_percentage: rollout, _variants: variants,
          _audience: audience, _description: description || null,
          _start_at: null, _end_at: null, _auto_kill_enabled: autoKill,
        } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Experimento salvo' });
      onSaved();
    },
    onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar' : 'Novo'} experimento</DialogTitle>
          <DialogDescription>
            Apenas tipos visuais. O motor garante: variants ≥ 2, control obrigatório,
            rollout 0..100, kill switch automático em degradação severa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Chave (slug)</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)}
                placeholder="cta_wording_v1" disabled={!!editing} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as SafeExperimentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SAFE_EXPERIMENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rollout (%)</Label>
              <Input type="number" min={0} max={100} value={rollout}
                onChange={(e) => setRollout(Number(e.target.value))} />
            </div>
            <div className="flex items-end gap-2">
              <Switch checked={autoKill} onCheckedChange={setAutoKill} id="autoKill" />
              <Label htmlFor="autoKill">Kill switch automático</Label>
            </div>
          </div>
          <div>
            <Label>Variantes (JSON)</Label>
            <Textarea rows={8} className="font-mono text-xs"
              value={variantsJson} onChange={(e) => setVariantsJson(e.target.value)} />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Cada variante: {`{ id, label?, weight?, isControl?, payload? }`}. Pelo menos 1 com isControl=true.
            </p>
          </div>
          <div>
            <Label>Audience (JSON)</Label>
            <Textarea rows={4} className="font-mono text-xs"
              value={audienceJson} onChange={(e) => setAudienceJson(e.target.value)} />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Opcional: {`{ device?, sources?, releases?, regions?, userType? }`}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar (draft)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
