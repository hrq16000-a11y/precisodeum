/**
 * AdminWebVitalsPage — Core Web Vitals (LCP / CLS / INP) coletados por
 * `webVitalsPerRoute` em `web_vitals_log`.
 *
 * Serve para validar o impacto das otimizações de imagem (AVIF/WebP responsivo,
 * blur-up, lazy loading): compare o p75 antes/depois pela série diária.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Download, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AsyncBoundary, SkeletonCardGrid, SkeletonTable } from '@/components/motion';
import {
  CORE_METRICS,
  deviceOf,
  formatMetric,
  summarizeByRoute,
  summarizeDaily,
  summarizeMetric,
  THRESHOLDS,
  type Rating,
  type VitalSample,
} from '@/lib/webVitals/summary';

const RATING_LABEL: Record<Rating, string> = {
  good: 'Bom',
  'needs-improvement': 'A melhorar',
  poor: 'Ruim',
};

const RatingBadge = ({ rating }: { rating: Rating }) => (
  <Badge
    variant={rating === 'poor' ? 'destructive' : rating === 'good' ? 'secondary' : 'outline'}
    className="text-[10px]"
  >
    {RATING_LABEL[rating]}
  </Badge>
);

const AdminWebVitalsPage = () => {
  const [rows, setRows] = useState<VitalSample[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('7');
  const [device, setDevice] = useState<'all' | 'mobile' | 'desktop'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const since = new Date(Date.now() - Number(days) * 86400_000).toISOString();
    const { data, error: err } = await supabase
      .from('web_vitals_log')
      .select('metric, value, route, rating, viewport, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (err) setError(err);
    setRows((data as VitalSample[]) ?? []);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const samples = useMemo(() => {
    if (!rows) return [];
    if (device === 'all') return rows;
    return rows.filter((r) => deviceOf(r.viewport) === device);
  }, [rows, device]);

  const summaries = useMemo(
    () => CORE_METRICS.map((m) => summarizeMetric(m, samples)),
    [samples],
  );
  const byRoute = useMemo(() => summarizeByRoute(samples, 3).slice(0, 40), [samples]);
  const daily = useMemo(() => summarizeDaily(samples), [samples]);

  const exportCsv = () => {
    const header = 'rota,amostras,lcp_p75_ms,cls_p75,inp_p75_ms,pior_classificacao';
    const lines = byRoute.map((r) =>
      [r.route, r.samples, r.lcpP75 ?? '', r.clsP75 ?? '', r.inpP75 ?? '', r.worst].join(','),
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `core-web-vitals-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Core Web Vitals</h2>
          <p className="text-sm text-muted-foreground">
            p75 de LCP, CLS e INP por rota — use a série diária para comparar antes/depois
            das otimizações de imagem.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={device} onValueChange={(v) => setDevice(v as typeof device)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos dispositivos</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="desktop">Desktop</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-4 w-4" aria-hidden />
            CSV
          </Button>
        </div>
      </div>

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && samples.length === 0}
        skeleton={<SkeletonCardGrid count={3} />}
        emptyTitle="Sem amostras neste período"
        emptyDescription="As métricas são enviadas pelos visitantes reais. Aguarde tráfego ou amplie a janela."
        onRetry={() => void load()}
      >
        <div className="motion-stagger grid gap-3 sm:grid-cols-3">
          {summaries.map((s) => (
            <Card key={s.metric} className="motion-enter">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {s.metric}
                  </span>
                  <RatingBadge rating={s.rating} />
                </CardTitle>
                <CardDescription className="text-xs">
                  meta ≤ {formatMetric(s.metric, THRESHOLDS[s.metric as 'LCP'].good)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-semibold">{formatMetric(s.metric, s.p75)}</p>
                <p className="text-xs text-muted-foreground">
                  p50 {formatMetric(s.metric, s.p50)} · p95 {formatMetric(s.metric, s.p95)} ·{' '}
                  {s.samples} amostras
                </p>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="bg-primary transition-all duration-500"
                    style={{ width: `${s.goodRate}%` }}
                  />
                  <div
                    className="bg-amber-500 transition-all duration-500"
                    style={{ width: `${s.samples ? (s.needsImprovement / s.samples) * 100 : 0}%` }}
                  />
                  <div
                    className="bg-destructive transition-all duration-500"
                    style={{ width: `${s.samples ? (s.poor / s.samples) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{s.goodRate}% das visitas em “Bom”</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="motion-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tendência diária (p75)</CardTitle>
            <CardDescription className="text-xs">
              Compare o dia do deploy das otimizações com os anteriores.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/60 text-left">
                  <th className="py-2 pr-2">Dia</th>
                  <th className="py-2 pr-2">LCP</th>
                  <th className="py-2 pr-2">CLS</th>
                  <th className="py-2 pr-2">INP</th>
                  <th className="py-2 pr-2">Amostras</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d) => (
                  <tr key={d.day} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-2 whitespace-nowrap">{d.day}</td>
                    <td className="py-2 pr-2">{formatMetric('LCP', d.lcpP75)}</td>
                    <td className="py-2 pr-2">{formatMetric('CLS', d.clsP75)}</td>
                    <td className="py-2 pr-2">{formatMetric('INP', d.inpP75)}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{d.samples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="motion-enter">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              {device === 'mobile' ? (
                <Smartphone className="h-4 w-4" aria-hidden />
              ) : (
                <Monitor className="h-4 w-4" aria-hidden />
              )}
              Piores rotas (mín. 3 amostras)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {byRoute.length === 0 ? (
              <SkeletonTable rows={3} />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/60 text-left">
                    <th className="py-2 pr-2">Rota</th>
                    <th className="py-2 pr-2">LCP p75</th>
                    <th className="py-2 pr-2">CLS p75</th>
                    <th className="py-2 pr-2">INP p75</th>
                    <th className="py-2 pr-2">Amostras</th>
                    <th className="py-2 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {byRoute.map((r) => (
                    <tr key={r.route} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-2 font-mono text-xs">{r.route}</td>
                      <td className="py-2 pr-2">{formatMetric('LCP', r.lcpP75)}</td>
                      <td className="py-2 pr-2">{formatMetric('CLS', r.clsP75)}</td>
                      <td className="py-2 pr-2">{formatMetric('INP', r.inpP75)}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{r.samples}</td>
                      <td className="py-2 pr-2">
                        <RatingBadge rating={r.worst} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <ImageLcpCorrelationCard samples={samples} />
      </AsyncBoundary>
    </div>
  );
};

export default AdminWebVitalsPage;
