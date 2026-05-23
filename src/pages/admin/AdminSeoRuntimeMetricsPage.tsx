/**
 * AdminSeoRuntimeMetricsPage — Fase 2.9
 *
 * Compara performance (LCP/CLS de web_vitals_log) com CTR (audit_log
 * resource_type=public_funnel) por rota, para medir o impacto da adoção
 * SEO Fase 2.9 antes/depois.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSeoHead } from '@/hooks/useSeoHead';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface RouteRow {
  route: string;
  lcpP75: number | null;
  clsP75: number | null;
  samples: number;
  views: number;
  leads: number;
  ctr: number;
}

function p75(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75));
  return Math.round(sorted[idx] * 100) / 100;
}

function normalizeRoute(path: string): string {
  return path.split('?')[0].replace(/\/+$/, '') || '/';
}

export default function AdminSeoRuntimeMetricsPage() {
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useSeoHead({
    title: 'SEO Runtime · Métricas',
    description: 'LCP/CLS + CTR por rota após adoção SEO Fase 2.9.',
    noindex: true,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const [vitalsRes, funnelRes] = await Promise.all([
        supabase
          .from('web_vitals_log' as any)
          .select('route, metric, value')
          .gte('created_at', since)
          .in('metric', ['LCP', 'CLS'])
          .limit(10000),
        supabase
          .from('audit_log')
          .select('action, details')
          .eq('resource_type', 'public_funnel')
          .gte('created_at', since)
          .limit(10000),
      ]);

      if (!mounted) return;

      const lcpByRoute = new Map<string, number[]>();
      const clsByRoute = new Map<string, number[]>();
      for (const r of (vitalsRes.data || []) as Array<{
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
      for (const r of (funnelRes.data || []) as Array<{
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

      const routeKeys = new Set<string>([
        ...lcpByRoute.keys(),
        ...clsByRoute.keys(),
        ...ctrByRoute.keys(),
      ]);

      const list: RouteRow[] = Array.from(routeKeys).map((route) => {
        const lcps = lcpByRoute.get(route) || [];
        const clss = clsByRoute.get(route) || [];
        const fn = ctrByRoute.get(route) || { views: 0, leads: 0 };
        return {
          route,
          lcpP75: p75(lcps),
          clsP75: p75(clss),
          samples: lcps.length + clss.length,
          views: fn.views,
          leads: fn.leads,
          ctr: fn.views > 0 ? fn.leads / fn.views : 0,
        };
      });

      list.sort((a, b) => b.views - a.views);
      setRows(list);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      q.trim()
        ? rows.filter((r) => r.route.toLowerCase().includes(q.toLowerCase()))
        : rows,
    [rows, q],
  );

  return (
    <div className="container py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">SEO Runtime · Métricas</h1>
        <p className="text-sm text-muted-foreground">
          Últimos 14 dias · LCP/CLS p75 + CTR (views → leads) por rota.
        </p>
      </header>

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
            <CardTitle>Top rotas SEO ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Rota</th>
                    <th className="py-2">LCP p75</th>
                    <th className="py-2">CLS p75</th>
                    <th className="py-2">Views</th>
                    <th className="py-2">Leads</th>
                    <th className="py-2">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((r) => {
                    const lcpBad = r.lcpP75 != null && r.lcpP75 > 2500;
                    const clsBad = r.clsP75 != null && r.clsP75 > 0.1;
                    return (
                      <tr key={r.route} className="border-t border-border">
                        <td className="py-2 font-mono text-xs">{r.route}</td>
                        <td className="py-2">
                          {r.lcpP75 != null ? (
                            <Badge variant={lcpBad ? 'destructive' : 'secondary'}>
                              {r.lcpP75} ms
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2">
                          {r.clsP75 != null ? (
                            <Badge variant={clsBad ? 'destructive' : 'secondary'}>
                              {r.clsP75}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2">{r.views}</td>
                        <td className="py-2">{r.leads}</td>
                        <td className="py-2">
                          {(r.ctr * 100).toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sem dados nesse período.
                </p>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Dica DEV: em desenvolvimento, abra o console e digite{' '}
              <code>window.__SEO_RUNTIME_DEBUG</code> para inspecionar render_ms,
              FAQ, links e content_words por página visitada.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
