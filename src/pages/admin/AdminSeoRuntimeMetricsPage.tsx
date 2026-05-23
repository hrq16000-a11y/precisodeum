/**
 * AdminSeoRuntimeMetricsPage — Fase 2.9
 *
 * Compara performance (LCP/CLS de web_vitals_log) com CTR (audit_log
 * resource_type=public_funnel) por rota, em duas janelas (A vs B) para
 * medir impacto antes/depois da adoção SEO. Exporta CSV.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSeoHead } from '@/hooks/useSeoHead';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';

interface WindowMetrics {
  lcpP75: number | null;
  clsP75: number | null;
  samples: number;
  views: number;
  leads: number;
  ctr: number;
}

interface RouteRow {
  route: string;
  a: WindowMetrics;
  b: WindowMetrics;
}

function p75(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75));
  return Math.round(sorted[idx] * 100) / 100;
}

function normalizeRoute(path: string): string {
  return path.split('?')[0].replace(/\/+$/, '') || '/';
}

function isoStart(d: string) {
  return new Date(`${d}T00:00:00`).toISOString();
}
function isoEnd(d: string) {
  return new Date(`${d}T23:59:59.999`).toISOString();
}

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function fetchWindow(start: string, end: string): Promise<Map<string, WindowMetrics>> {
  const [vitalsRes, funnelRes] = await Promise.all([
    supabase
      .from('web_vitals_log' as any)
      .select('route, metric, value')
      .gte('created_at', start)
      .lte('created_at', end)
      .in('metric', ['LCP', 'CLS'])
      .limit(10000),
    supabase
      .from('audit_log')
      .select('action, details')
      .eq('resource_type', 'public_funnel')
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(10000),
  ]);

  const lcpByRoute = new Map<string, number[]>();
  const clsByRoute = new Map<string, number[]>();
  for (const r of ((vitalsRes.data || []) as unknown) as Array<{
    route: string;
    metric: string;
    value: number;
  }>) {
    const key = normalizeRoute(r.route || '');
    if (!key) continue;
    const bucket = r.metric === 'LCP' ? lcpByRoute : clsByRoute;
    const arr = bucket.get(key) ?? [];
    arr.push(Number(r.value) || 0);
    bucket.set(key, arr);
  }

  const ctrByRoute = new Map<string, { views: number; leads: number }>();
  for (const r of ((funnelRes.data || []) as unknown) as Array<{
    action: string;
    details: any;
  }>) {
    const path = r.details?.path;
    if (typeof path !== 'string') continue;
    const key = normalizeRoute(path);
    const cur = ctrByRoute.get(key) ?? { views: 0, leads: 0 };
    if (r.action === 'category_view' || r.action === 'city_view' || r.action === 'profile_view') {
      cur.views += 1;
    }
    if (r.action === 'lead_submit') cur.leads += 1;
    ctrByRoute.set(key, cur);
  }

  const keys = new Set<string>([
    ...lcpByRoute.keys(),
    ...clsByRoute.keys(),
    ...ctrByRoute.keys(),
  ]);

  const out = new Map<string, WindowMetrics>();
  for (const route of keys) {
    const lcps = lcpByRoute.get(route) || [];
    const clss = clsByRoute.get(route) || [];
    const fn = ctrByRoute.get(route) || { views: 0, leads: 0 };
    out.set(route, {
      lcpP75: p75(lcps),
      clsP75: p75(clss),
      samples: lcps.length + clss.length,
      views: fn.views,
      leads: fn.leads,
      ctr: fn.views > 0 ? fn.leads / fn.views : 0,
    });
  }
  return out;
}

function diffBadge(a: number | null, b: number | null, lowerIsBetter: boolean) {
  if (a == null || b == null) return <span className="text-muted-foreground">—</span>;
  const delta = b - a;
  if (Math.abs(delta) < 1e-9) return <span className="text-muted-foreground">0</span>;
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  const sign = delta > 0 ? '+' : '';
  return (
    <Badge variant={better ? 'secondary' : 'destructive'}>
      {sign}
      {Math.round(delta * 100) / 100}
    </Badge>
  );
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminSeoRuntimeMetricsPage() {
  const today = new Date();
  const fourteenAgo = new Date(today.getTime() - 14 * 86400000);
  const sevenAgo = new Date(today.getTime() - 7 * 86400000);

  const [aStart, setAStart] = useState(fmtDate(fourteenAgo));
  const [aEnd, setAEnd] = useState(fmtDate(sevenAgo));
  const [bStart, setBStart] = useState(fmtDate(sevenAgo));
  const [bEnd, setBEnd] = useState(fmtDate(today));

  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useSeoHead({
    title: 'SEO Runtime · Métricas',
    description: 'LCP/CLS + CTR por rota com comparação antes/depois.',
    noindex: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetchWindow(isoStart(aStart), isoEnd(aEnd)),
        fetchWindow(isoStart(bStart), isoEnd(bEnd)),
      ]);
      const allRoutes = new Set<string>([...a.keys(), ...b.keys()]);
      const empty: WindowMetrics = {
        lcpP75: null,
        clsP75: null,
        samples: 0,
        views: 0,
        leads: 0,
        ctr: 0,
      };
      const list: RouteRow[] = Array.from(allRoutes).map((route) => ({
        route,
        a: a.get(route) || empty,
        b: b.get(route) || empty,
      }));
      list.sort((x, y) => y.b.views + y.a.views - (x.b.views + x.a.views));
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [aStart, aEnd, bStart, bEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      q.trim()
        ? rows.filter((r) => r.route.toLowerCase().includes(q.toLowerCase()))
        : rows,
    [rows, q],
  );

  const handleExportCsv = () => {
    const header = [
      'route',
      `A_${aStart}_${aEnd}_lcp_p75`,
      `A_cls_p75`,
      'A_views',
      'A_leads',
      'A_ctr_pct',
      `B_${bStart}_${bEnd}_lcp_p75`,
      'B_cls_p75',
      'B_views',
      'B_leads',
      'B_ctr_pct',
      'delta_lcp',
      'delta_cls',
      'delta_ctr_pct',
    ];
    const data: string[][] = [header];
    for (const r of filtered) {
      const dCtr =
        r.a.ctr || r.b.ctr ? ((r.b.ctr - r.a.ctr) * 100).toFixed(2) : '';
      data.push([
        r.route,
        r.a.lcpP75 ?? '',
        r.a.clsP75 ?? '',
        r.a.views,
        r.a.leads,
        (r.a.ctr * 100).toFixed(2),
        r.b.lcpP75 ?? '',
        r.b.clsP75 ?? '',
        r.b.views,
        r.b.leads,
        (r.b.ctr * 100).toFixed(2),
        r.a.lcpP75 != null && r.b.lcpP75 != null
          ? (r.b.lcpP75 - r.a.lcpP75).toFixed(2)
          : '',
        r.a.clsP75 != null && r.b.clsP75 != null
          ? (r.b.clsP75 - r.a.clsP75).toFixed(3)
          : '',
        dCtr,
      ].map(String));
    }
    downloadCsv(`seo-runtime_${aStart}_vs_${bStart}.csv`, data);
  };

  return (
    <div className="container py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">SEO Runtime · Métricas</h1>
        <p className="text-sm text-muted-foreground">
          Comparação antes/depois · LCP/CLS p75 + CTR (views → leads) por rota.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Janelas de comparação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Período A (antes)
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="a-start" className="text-xs">De</Label>
                  <Input id="a-start" type="date" value={aStart} onChange={(e) => setAStart(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label htmlFor="a-end" className="text-xs">Até</Label>
                  <Input id="a-end" type="date" value={aEnd} onChange={(e) => setAEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Período B (depois)
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="b-start" className="text-xs">De</Label>
                  <Input id="b-start" type="date" value={bStart} onChange={(e) => setBStart(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label htmlFor="b-end" className="text-xs">Até</Label>
                  <Input id="b-end" type="date" value={bEnd} onChange={(e) => setBEnd(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={load} disabled={loading} size="sm">
              {loading ? 'Carregando…' : 'Recarregar'}
            </Button>
            <Button
              onClick={handleExportCsv}
              variant="outline"
              size="sm"
              disabled={loading || filtered.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Input
        placeholder="Filtrar por rota (/categoria/, /cidade/, /profissional/...)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Comparação por rota ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th rowSpan={2} className="py-2 pr-2 align-bottom">Rota</th>
                    <th colSpan={3} className="py-2 text-center border-l border-border">
                      A · {aStart} → {aEnd}
                    </th>
                    <th colSpan={3} className="py-2 text-center border-l border-border">
                      B · {bStart} → {bEnd}
                    </th>
                    <th colSpan={3} className="py-2 text-center border-l border-border">
                      Δ (B − A)
                    </th>
                  </tr>
                  <tr>
                    <th className="py-1 border-l border-border">LCP</th>
                    <th className="py-1">CLS</th>
                    <th className="py-1">CTR</th>
                    <th className="py-1 border-l border-border">LCP</th>
                    <th className="py-1">CLS</th>
                    <th className="py-1">CTR</th>
                    <th className="py-1 border-l border-border">LCP</th>
                    <th className="py-1">CLS</th>
                    <th className="py-1">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((r) => (
                    <tr key={r.route} className="border-t border-border">
                      <td className="py-2 pr-2 font-mono text-xs">{r.route}</td>
                      <td className="py-2 border-l border-border">{r.a.lcpP75 ?? '—'}</td>
                      <td className="py-2">{r.a.clsP75 ?? '—'}</td>
                      <td className="py-2">{(r.a.ctr * 100).toFixed(2)}%</td>
                      <td className="py-2 border-l border-border">{r.b.lcpP75 ?? '—'}</td>
                      <td className="py-2">{r.b.clsP75 ?? '—'}</td>
                      <td className="py-2">{(r.b.ctr * 100).toFixed(2)}%</td>
                      <td className="py-2 border-l border-border">
                        {diffBadge(r.a.lcpP75, r.b.lcpP75, true)}
                      </td>
                      <td className="py-2">
                        {diffBadge(r.a.clsP75, r.b.clsP75, true)}
                      </td>
                      <td className="py-2">
                        {diffBadge(r.a.ctr * 100, r.b.ctr * 100, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sem dados nesse período.
                </p>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              LCP/CLS menor = melhor (verde). CTR maior = melhor (verde).
              Dica DEV: <code>window.__SEO_RUNTIME_DEBUG</code> mostra render_ms,
              FAQ, links e content_words da página atual.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
