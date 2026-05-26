/**
 * Painel administrativo · Onboarding Regression Watch
 *
 * Permite gestão 100% do detector automático:
 *  - Liga/desliga via `site_settings.onboarding_regression_watch_enabled`.
 *  - Dispara a RPC manualmente ("Rodar agora") com parâmetros customizáveis.
 *  - Lista anomalias detectadas em onboarding_events (event='onboarding_regression_detected').
 *  - Filtra por severidade, métrica e janela.
 *  - Exporta CSV.
 *
 * Sem nova tabela. Toda persistência via tabelas já existentes.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, Download, Play, RefreshCcw, ShieldCheck, ShieldOff } from 'lucide-react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { METRIC_DEFINITIONS, type Severity } from '@/lib/onboarding/regressionDetector';

const SEVERITY_VARIANT: Record<Severity, string> = {
  low: 'bg-slate-200 text-slate-800',
  medium: 'bg-amber-200 text-amber-900',
  high: 'bg-orange-300 text-orange-950',
  critical: 'bg-red-500 text-white',
};

interface AnomalyRow {
  id: string;
  created_at: string;
  meta: Record<string, unknown> | null;
}

export default function AdminOnboardingRegressionPage() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [metricFilter, setMetricFilter] = useState<string>('all');
  const [hours, setHours] = useState<number>(24);

  // ---- Flag global (liga/desliga) -------------------------------------------------
  const flagQuery = useQuery({
    queryKey: ['admin', 'reg-watch', 'flag'],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value, updated_at')
        .eq('key', 'onboarding_regression_watch_enabled')
        .maybeSingle();
      if (error) throw error;
      return {
        enabled: data?.value === true || (data?.value as unknown) === 'true',
        updated_at: data?.updated_at as string | undefined,
      };
    },
  });

  const flagMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key: 'onboarding_regression_watch_enabled', value: next as unknown as never, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reg-watch', 'flag'] });
      toast({ title: next ? 'Detector ativado' : 'Detector desativado', description: next ? 'Cron rodará a cada 15 min.' : 'Cron continua agendado, mas suprime execução.' });
    },
    onError: (err: Error) => toast({ title: 'Falha ao alterar flag', description: err.message, variant: 'destructive' }),
  });

  // ---- Anomalias ------------------------------------------------------------------
  const anomaliesQuery = useQuery({
    queryKey: ['admin', 'reg-watch', 'anomalies', hours],
    enabled: !!isAdmin,
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      const { data, error } = await supabase
        .from('onboarding_events')
        .select('id, created_at, meta')
        .eq('event', 'onboarding_regression_detected')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as AnomalyRow[]) ?? [];
    },
  });

  // ---- "Rodar agora" --------------------------------------------------------------
  const [runOpts, setRunOpts] = useState({ window_minutes: 60, baseline_days: 7, debounce_hours: 6 });
  const runMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('detect_onboarding_regressions', {
        _window_minutes: runOpts.window_minutes,
        _baseline_days: runOpts.baseline_days,
        _debounce_hours: runOpts.debounce_hours,
      });
      if (error) throw error;
      return data as { inserted: number; anomalies: unknown[] } | null;
    },
    onSuccess: (data) => {
      const n = data?.inserted ?? 0;
      toast({ title: 'Detector executado', description: `${n} anomalia(s) registrada(s).` });
      queryClient.invalidateQueries({ queryKey: ['admin', 'reg-watch', 'anomalies'] });
    },
    onError: (err: Error) => toast({ title: 'Falha na execução', description: err.message, variant: 'destructive' }),
  });

  const filteredAnomalies = useMemo(() => {
    const list = anomaliesQuery.data ?? [];
    return list.filter((a) => {
      const m = (a.meta ?? {}) as Record<string, string>;
      if (severityFilter !== 'all' && m.severity !== severityFilter) return false;
      if (metricFilter !== 'all' && m.metric !== metricFilter) return false;
      return true;
    });
  }, [anomaliesQuery.data, severityFilter, metricFilter]);

  const kpis = useMemo(() => {
    const list = anomaliesQuery.data ?? [];
    const bySev: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byMetric = new Map<string, number>();
    for (const a of list) {
      const m = (a.meta ?? {}) as Record<string, string>;
      if (m.severity) bySev[m.severity] = (bySev[m.severity] ?? 0) + 1;
      if (m.metric) byMetric.set(m.metric, (byMetric.get(m.metric) ?? 0) + 1);
    }
    const topMetric = [...byMetric.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total: list.length, bySev, topMetric };
  }, [anomaliesQuery.data]);

  const exportCsv = () => {
    const header = ['created_at', 'severity', 'metric', 'delta', 'current', 'baseline', 'sample_current', 'sample_baseline', 'app_version', 'release_channel'];
    const lines = [header.join(',')];
    for (const a of filteredAnomalies) {
      const m = (a.meta ?? {}) as Record<string, unknown>;
      lines.push([
        a.created_at,
        String(m.severity ?? ''),
        String(m.metric ?? ''),
        String(m.delta ?? ''),
        String(m.current ?? ''),
        String(m.baseline ?? ''),
        String(m.sample_current ?? ''),
        String(m.sample_baseline ?? ''),
        String(m.app_version ?? ''),
        String(m.release_channel ?? ''),
      ].map((v) => `"${v.replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `regression-anomalies-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (adminLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <div className="p-6 text-sm text-destructive">Acesso restrito a administradores.</div>;

  const enabled = !!flagQuery.data?.enabled;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 space-y-6 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Onboarding Regression Watch
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Detecção automática de regressões. Cron roda a cada 15 min quando ativado.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { flagQuery.refetch(); anomaliesQuery.refetch(); }}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        {/* Switch global */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {enabled ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
              Estado do detector
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <p className="text-sm">
                {enabled ? 'Ativo — cron executa a cada 15 min.' : 'Desativado — anomalias não serão registradas automaticamente.'}
              </p>
              {flagQuery.data?.updated_at && (
                <p className="text-xs text-muted-foreground">Última alteração: {new Date(flagQuery.data.updated_at).toLocaleString('pt-BR')}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="watch-toggle" className="text-sm">{enabled ? 'Ativado' : 'Desativado'}</Label>
              <Switch
                id="watch-toggle"
                checked={enabled}
                disabled={flagMutation.isPending || flagQuery.isLoading}
                onCheckedChange={(v) => flagMutation.mutate(v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rodar agora */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Play className="h-5 w-5" /> Executar manualmente</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <Label htmlFor="wm" className="text-xs">Janela atual (min)</Label>
              <Input id="wm" type="number" min={5} max={1440} value={runOpts.window_minutes}
                onChange={(e) => setRunOpts({ ...runOpts, window_minutes: Number(e.target.value) || 60 })} />
            </div>
            <div>
              <Label htmlFor="bd" className="text-xs">Baseline (dias)</Label>
              <Input id="bd" type="number" min={1} max={30} value={runOpts.baseline_days}
                onChange={(e) => setRunOpts({ ...runOpts, baseline_days: Number(e.target.value) || 7 })} />
            </div>
            <div>
              <Label htmlFor="dh" className="text-xs">Debounce (horas)</Label>
              <Input id="dh" type="number" min={0} max={48} value={runOpts.debounce_hours}
                onChange={(e) => setRunOpts({ ...runOpts, debounce_hours: Number(e.target.value) || 6 })} />
            </div>
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
              <Play className="h-4 w-4 mr-2" /> {runMutation.isPending ? 'Executando…' : 'Rodar agora'}
            </Button>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total ({hours}h)</p><p className="text-2xl font-bold">{kpis.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Críticas</p><p className="text-2xl font-bold text-red-600">{kpis.bySev.critical}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Altas</p><p className="text-2xl font-bold text-orange-600">{kpis.bySev.high}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Métrica mais alertada</p><p className="text-sm font-semibold truncate">{kpis.topMetric ? `${kpis.topMetric[0]} (${kpis.topMetric[1]})` : '—'}</p></CardContent></Card>
        </div>

        {/* Filtros + tabela */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Anomalias detectadas</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filteredAnomalies.length}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger><SelectValue placeholder="Severidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas severidades</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={metricFilter} onValueChange={setMetricFilter}>
                <SelectTrigger><SelectValue placeholder="Métrica" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas métricas</SelectItem>
                  {Object.keys(METRIC_DEFINITIONS).map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Janela" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Últimas 6h</SelectItem>
                  <SelectItem value="24">Últimas 24h</SelectItem>
                  <SelectItem value="72">Últimos 3 dias</SelectItem>
                  <SelectItem value="168">Últimos 7 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Métrica</TableHead>
                    <TableHead className="text-right">Atual</TableHead>
                    <TableHead className="text-right">Baseline</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead className="text-right">N (cur/base)</TableHead>
                    <TableHead>Versão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomaliesQuery.isLoading && (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Carregando…</TableCell></TableRow>
                  )}
                  {!anomaliesQuery.isLoading && filteredAnomalies.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Nenhuma anomalia no período/filtros.</TableCell></TableRow>
                  )}
                  {filteredAnomalies.map((a) => {
                    const m = (a.meta ?? {}) as Record<string, unknown>;
                    const sev = (m.severity as Severity) ?? 'low';
                    const cur = Number(m.current ?? 0);
                    const base = Number(m.baseline ?? 0);
                    const delta = Number(m.delta ?? 0);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleString('pt-BR')}</TableCell>
                        <TableCell><Badge className={SEVERITY_VARIANT[sev]}>{sev}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{String(m.metric ?? '')}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{cur.toFixed(3)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{base.toFixed(3)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{delta > 0 ? '+' : ''}{delta.toFixed(3)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{String(m.sample_current ?? '?')}/{String(m.sample_baseline ?? '?')}</TableCell>
                        <TableCell className="text-xs">{String(m.app_version ?? '—')}<span className="text-muted-foreground"> · {String(m.release_channel ?? '—')}</span></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
