/**
 * AdminSeoLandingsPage — Fase 2.7
 *
 * Painel admin de telemetria de landings SEO. Lê audit_log
 * (resource_type='public_funnel') para agregar por path: views, leads,
 * CTR. Sinaliza thin/healthy/sponsored com base no SEO Route Registry.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSeoHead } from '@/hooks/useSeoHead';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

interface LandingRow {
  path: string;
  views: number;
  leads: number;
  ctr: number;
  type: 'category' | 'category_city' | 'city' | 'other';
}

function inferType(path: string): LandingRow['type'] {
  if (/^\/categoria\/[^/]+\/em\/[^/]+$/.test(path)) return 'category_city';
  if (/^\/categoria\/[^/]+$/.test(path)) return 'category';
  if (/^\/cidade\/[^/]+$/.test(path)) return 'city';
  return 'other';
}

export default function AdminSeoLandingsPage() {
  const [rows, setRows] = useState<LandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useSeoHead({ title: 'SEO Landings · Admin', description: 'Telemetria de landings SEO.', noindex: true });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('audit_log')
        .select('action, details, created_at')
        .eq('resource_type', 'public_funnel')
        .gte('created_at', since)
        .limit(5000);

      if (!mounted) return;
      if (error || !data) {
        setRows([]);
        setLoading(false);
        return;
      }

      const acc = new Map<string, { views: number; leads: number }>();
      for (const r of data as Array<{ action: string; details: any }>) {
        const path: string | undefined = r.details?.path;
        if (!path || typeof path !== 'string') continue;
        const norm = path.split('?')[0];
        const t = inferType(norm);
        if (t === 'other') continue;
        const cur = acc.get(norm) ?? { views: 0, leads: 0 };
        if (r.action === 'category_view' || r.action === 'city_view') cur.views += 1;
        if (r.action === 'lead_submit') cur.leads += 1;
        acc.set(norm, cur);
      }

      const list: LandingRow[] = Array.from(acc.entries()).map(([path, v]) => ({
        path,
        views: v.views,
        leads: v.leads,
        ctr: v.views > 0 ? v.leads / v.views : 0,
        type: inferType(path),
      }));
      list.sort((a, b) => b.views - a.views);
      setRows(list);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.path.toLowerCase().includes(term));
  }, [rows, q]);

  const thin = filtered.filter((r) => r.views < 5);
  const noClicks = filtered.filter((r) => r.views >= 5 && r.leads === 0);
  const high = filtered.filter((r) => r.ctr >= 0.04 && r.views >= 10);

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      <Helmet>
        <title>SEO Landings · Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SEO Landings</h1>
          <p className="text-sm text-muted-foreground">
            Telemetria 30d · views, leads e CTR por landing.
          </p>
        </div>
        <Input
          placeholder="Filtrar por path…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </header>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top landings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {filtered.slice(0, 20).map((r) => (
                <div key={r.path} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.path}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.views}v · {r.leads}l · {(r.ctr * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
              {!filtered.length && (
                <p className="text-muted-foreground">Sem dados no período.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Thin pages <Badge variant="destructive">{thin.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm max-h-80 overflow-auto">
              {thin.slice(0, 50).map((r) => (
                <div key={r.path} className="truncate text-muted-foreground">
                  {r.path}
                </div>
              ))}
              {!thin.length && <p className="text-muted-foreground">Nenhuma.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Sem cliques <Badge variant="secondary">{noClicks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm max-h-80 overflow-auto">
              {noClicks.slice(0, 50).map((r) => (
                <div key={r.path} className="truncate text-muted-foreground">
                  {r.path} · {r.views}v
                </div>
              ))}
              {!noClicks.length && <p className="text-muted-foreground">Nenhuma.</p>}
            </CardContent>
          </Card>

          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Alta conversão <Badge>{high.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm md:grid-cols-2 lg:grid-cols-3">
              {high.slice(0, 60).map((r) => (
                <div key={r.path} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.path}</span>
                  <span className="tabular-nums text-foreground">
                    {(r.ctr * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
              {!high.length && (
                <p className="text-muted-foreground">Nenhuma landing com CTR ≥ 4%.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
