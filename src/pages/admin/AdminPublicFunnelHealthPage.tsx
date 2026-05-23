/**
 * AdminPublicFunnelHealthPage — Sprint A · Etapa 4
 *
 * Health do funil público (audit_log resource_type='public_funnel').
 * Mostra emissão x persistência por evento, top landings SEO,
 * top origens/destinos de internal_link_click, CTR interno por landing
 * e últimos eventos. Apenas observabilidade — sem ranking, sem score.
 *
 * Lazy-loaded em /admin/funil-health. React Query staleTime 60s,
 * sem polling, sem realtime.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSeoHead } from '@/hooks/useSeoHead';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FunnelHealth {
  window_days: number;
  since: string;
  total_events: number;
  events_today: number;
  unique_paths: number;
  unique_sessions: number;
  internal_link_clicks: number;
  profile_views: number;
  lead_submits: number;
  sponsor_refs: number;
  by_event: Array<{ action: string; n: number }>;
  by_day: Array<{ d: string; n: number; clicks: number; profile_views: number; lead_submits: number }>;
  top_source_paths: Array<{ path: string; clicks: number }>;
  top_target_paths: Array<{ path: string; clicks: number }>;
  top_landings: Array<{ path: string; views: number }>;
  ctr_by_landing: Array<{ path: string; views: number; clicks: number; ctr_pct: number }>;
  orphan_landings: Array<{ path: string; views: number }>;
  recent_events: Array<{
    action: string;
    created_at: string;
    pathname: string | null;
    target_path: string | null;
    source: string | null;
    sponsor_ref: string | null;
  }>;
}

const WINDOWS = [1, 7, 30] as const;

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function AdminPublicFunnelHealthPage() {
  useSeoHead({
    title: 'Saúde do funil público · Admin',
    description: 'Observabilidade do funil SEO público (emissão x persistência).',
    noindex: true,
  });

  const [days, setDays] = useState<number>(7);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<FunnelHealth>({
    queryKey: ['admin-public-funnel-health', days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_public_funnel_health' as any,
        { _days: days } as any,
      );
      if (error) throw error;
      return data as unknown as FunnelHealth;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const eventMap = useMemo(() => {
    const m = new Map<string, number>();
    (data?.by_event ?? []).forEach((e) => m.set(e.action, e.n));
    return m;
  }, [data]);

  if (isError) {
    return (
      <main className="container mx-auto max-w-6xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Saúde do funil público</h1>
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Falha ao carregar dados: {(error as Error)?.message || 'erro desconhecido'}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Saúde do funil público</h1>
          <p className="text-sm text-muted-foreground">
            Eventos persistidos em <code className="text-xs">audit_log</code> (
            <code className="text-xs">resource_type=public_funnel</code>). Janela atual:{' '}
            <strong>{days} dia(s)</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <Button
              key={w}
              size="sm"
              variant={days === w ? 'default' : 'outline'}
              onClick={() => setDays(w)}
            >
              {w}d
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Atualizando…' : 'Atualizar'}
          </Button>
        </div>
      </header>

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Eventos totais (janela)" value={data.total_events.toLocaleString('pt-BR')} />
            <Kpi label="Eventos hoje" value={data.events_today.toLocaleString('pt-BR')} />
            <Kpi label="Sessões únicas" value={data.unique_sessions.toLocaleString('pt-BR')} />
            <Kpi label="Paths únicos" value={data.unique_paths.toLocaleString('pt-BR')} />
            <Kpi
              label="Cliques internos"
              value={data.internal_link_clicks.toLocaleString('pt-BR')}
              hint="anchor SEO related links"
            />
            <Kpi label="Visualizações de perfil" value={data.profile_views.toLocaleString('pt-BR')} />
            <Kpi label="Leads enviados" value={data.lead_submits.toLocaleString('pt-BR')} />
            <Kpi
              label="Atribuições sponsor"
              value={data.sponsor_refs.toLocaleString('pt-BR')}
              hint="sponsor_ref não nulo"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Eventos por tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      'public_search',
                      'category_view',
                      'city_view',
                      'profile_view',
                      'lead_submit',
                      'internal_link_click',
                    ].map((a) => (
                      <TableRow key={a}>
                        <TableCell className="font-mono text-xs">{a}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(eventMap.get(a) ?? 0).toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Eventos por dia</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dia</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Cliques</TableHead>
                      <TableHead className="text-right">Perfis</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_day.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">
                          Sem eventos na janela.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.by_day.map((d) => (
                        <TableRow key={d.d}>
                          <TableCell className="font-mono text-xs">{d.d}</TableCell>
                          <TableCell className="text-right tabular-nums">{d.n}</TableCell>
                          <TableCell className="text-right tabular-nums">{d.clicks}</TableCell>
                          <TableCell className="text-right tabular-nums">{d.profile_views}</TableCell>
                          <TableCell className="text-right tabular-nums">{d.lead_submits}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top páginas de origem (cliques)</CardTitle>
              </CardHeader>
              <CardContent>
                <PathTable rows={data.top_source_paths} valueKey="clicks" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top páginas de destino (cliques)</CardTitle>
              </CardHeader>
              <CardContent>
                <PathTable rows={data.top_target_paths} valueKey="clicks" />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top landings SEO (views)</CardTitle>
              </CardHeader>
              <CardContent>
                <PathTable rows={data.top_landings} valueKey="views" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Landings sem clique interno</CardTitle>
              </CardHeader>
              <CardContent>
                {data.orphan_landings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma landing órfã na janela.
                  </p>
                ) : (
                  <PathTable rows={data.orphan_landings} valueKey="views" />
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">CTR interno por landing</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ctr_by_landing.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-xs text-muted-foreground">
                        Sem dados na janela.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.ctr_by_landing.map((r) => (
                      <TableRow key={r.path}>
                        <TableCell className="max-w-[420px] truncate font-mono text-xs" title={r.path}>
                          {r.path}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.views}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.clicks}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.ctr_pct}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimos eventos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Sponsor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent_events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                        Sem eventos recentes.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recent_events.map((e, i) => (
                      <TableRow key={`${e.created_at}-${i}`}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {e.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-xs" title={e.pathname ?? ''}>
                          {e.pathname ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-xs" title={e.target_path ?? ''}>
                          {e.target_path ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{e.source ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{e.sponsor_ref ? '✓' : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function PathTable({
  rows,
  valueKey,
}: {
  rows: Array<{ path: string } & Record<string, number | string>>;
  valueKey: 'clicks' | 'views';
}) {
  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">Sem dados na janela.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Path</TableHead>
          <TableHead className="text-right capitalize">{valueKey}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.path}>
            <TableCell className="max-w-[420px] truncate font-mono text-xs" title={r.path}>
              {r.path}
            </TableCell>
            <TableCell className="text-right tabular-nums">{Number(r[valueKey] ?? 0)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
