import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, RefreshCw, ShieldCheck, AlertTriangle, AlertCircle,
  CheckCircle2, Clock, Ban, ZapOff, HeartPulse,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type HealthRow = {
  sponsor_id: string;
  title: string;
  health_status: 'healthy' | 'warning' | 'blocked' | 'expired' | 'inconsistent' | 'incomplete';
  blockers: string[] | null;
  warnings: string[] | null;
  expires_in_days: number | null;
  pacing_status: string | null;
  has_asset: boolean;
  scope_consistent: boolean;
  is_active: boolean;
  current_status: string;
};

const STATUS_META: Record<HealthRow['health_status'], { label: string; tone: string; Icon: any }> = {
  healthy:      { label: 'Saudável',     tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', Icon: CheckCircle2 },
  warning:      { label: 'Atenção',      tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',          Icon: AlertTriangle },
  blocked:      { label: 'Bloqueado',    tone: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',                  Icon: Ban },
  expired:      { label: 'Expirado',     tone: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',             Icon: Clock },
  inconsistent: { label: 'Inconsistente',tone: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',      Icon: AlertCircle },
  incomplete:   { label: 'Incompleto',   tone: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',      Icon: ZapOff },
};

const REASON_LABELS: Record<string, string> = {
  'expired:campaign_window_closed': 'Janela da campanha encerrada',
  'incomplete:missing_banner_or_logo': 'Sem banner ou logo',
  'inconsistent:scope_slug_missing': 'Escopo (cidade/categoria) sem slug',
  'blocked:rejected_by_admin': 'Rejeitado pelo admin',
  'pacing:critical': 'Pacing crítico',
  'pacing:warning': 'Pacing em atenção',
  'expiry:within_7_days': 'Expira em até 7 dias',
  'approval:pending': 'Aguardando aprovação',
  'flag:inactive_but_status_active': 'Flag active=false com status=active',
};

const labelOf = (code: string) => REASON_LABELS[code] ?? code;

const SponsorHealthPanel = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [overrideTarget, setOverrideTarget] = useState<HealthRow | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const { data = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sponsor-health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sponsor_health_status' as any, { _sponsor_id: null });
      if (error) throw error;
      return (data as HealthRow[]) || [];
    },
    staleTime: 30_000,
  });

  const kpis = useMemo(() => {
    const acc = { total: data.length, healthy: 0, warning: 0, blocked: 0, expired: 0, inconsistent: 0, incomplete: 0 };
    for (const r of data) acc[r.health_status]++;
    return acc;
  }, [data]);

  const activate = useMutation({
    mutationFn: async (vars: { id: string; override: boolean; reason?: string }) => {
      const { data, error } = await supabase.rpc('activate_sponsor_with_gate' as any, {
        _sponsor_id: vars.id,
        _override: vars.override,
        _override_reason: vars.reason ?? null,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast({ title: res.override ? 'Ativado com override' : 'Patrocinador ativado' });
        setOverrideTarget(null);
        setOverrideReason('');
        qc.invalidateQueries({ queryKey: ['sponsor-health'] });
        qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      } else {
        toast({
          title: 'Ativação bloqueada pelo Health Gate',
          description: (res?.blockers || []).map(labelOf).join(' · '),
          variant: 'destructive',
        });
      }
    },
    onError: (e: any) => toast({ title: 'Erro ao ativar', description: e?.message, variant: 'destructive' }),
  });

  const degrade = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('auto_degrade_expired_sponsors' as any);
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res: any) => {
      toast({ title: `Auto-degrade concluído`, description: `${res?.affected ?? 0} patrocinador(es) marcados inativos.` });
      qc.invalidateQueries({ queryKey: ['sponsor-health'] });
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
    onError: (e: any) => toast({ title: 'Erro no auto-degrade', description: e?.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Health Gate dos Patrocinadores</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button size="sm" variant="outline" onClick={() => degrade.mutate()} disabled={degrade.isPending}>
              <Clock className="h-4 w-4 mr-1" />
              Auto-degrade expirados
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mb-4">
            {(['total','healthy','warning','blocked','expired','inconsistent','incomplete'] as const).map(k => (
              <div key={k} className="rounded-md border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
                <div className="text-2xl font-semibold tabular-nums">{(kpis as any)[k]}</div>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando saúde…
            </div>
          ) : data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhum patrocinador encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrocinador</TableHead>
                    <TableHead>Saúde</TableHead>
                    <TableHead>Bloqueios</TableHead>
                    <TableHead>Avisos</TableHead>
                    <TableHead className="text-right">Expira</TableHead>
                    <TableHead>Pacing</TableHead>
                    <TableHead>Status atual</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(r => {
                    const meta = STATUS_META[r.health_status];
                    const Icon = meta.Icon;
                    const hasBlockers = (r.blockers?.length ?? 0) > 0;
                    return (
                      <TableRow key={r.sponsor_id}>
                        <TableCell className="font-medium max-w-[220px] truncate">{r.title}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${meta.tone}`}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          {hasBlockers ? (
                            <div className="flex flex-wrap gap-1">
                              {r.blockers!.map(b => (
                                <Badge key={b} variant="destructive" className="text-[10px]">{labelOf(b)}</Badge>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          {(r.warnings?.length ?? 0) > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.warnings!.map(w => (
                                <Badge key={w} variant="secondary" className="text-[10px]">{labelOf(w)}</Badge>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {r.expires_in_days === null ? '—' : `${r.expires_in_days}d`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">{r.pacing_status ?? '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.is_active ? 'default' : 'secondary'} className="text-[10px] capitalize">
                            {r.current_status}{r.is_active ? '' : ' · off'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.is_active && r.health_status === 'healthy' ? (
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" /> OK
                            </span>
                          ) : hasBlockers ? (
                            <Button size="sm" variant="outline" onClick={() => setOverrideTarget(r)}>
                              Ativar com override
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => activate.mutate({ id: r.sponsor_id, override: false })}
                              disabled={activate.isPending}
                            >
                              Ativar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!overrideTarget} onOpenChange={(o) => { if (!o) { setOverrideTarget(null); setOverrideReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override do Health Gate</DialogTitle>
          </DialogHeader>
          {overrideTarget && (
            <div className="space-y-3 text-sm">
              <div>
                Patrocinador: <strong>{overrideTarget.title}</strong>
              </div>
              <div>
                Bloqueios detectados:
                <div className="flex flex-wrap gap-1 mt-1">
                  {(overrideTarget.blockers || []).map(b => (
                    <Badge key={b} variant="destructive" className="text-[10px]">{labelOf(b)}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Motivo do override (mínimo 5 caracteres, fica em auditoria)
                </label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Ex.: aprovado comercialmente fora do gate por X motivo"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideTarget(null); setOverrideReason(''); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!overrideTarget || overrideReason.trim().length < 5 || activate.isPending}
              onClick={() => overrideTarget && activate.mutate({ id: overrideTarget.sponsor_id, override: true, reason: overrideReason.trim() })}
            >
              Confirmar override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SponsorHealthPanel;
