/**
 * FASE 2.1 — Public Funnel Telemetry (admin).
 *
 * Visibilidade operacional do funil público: busca → visualização → contato →
 * lead. Consulta a RPC `get_public_funnel_telemetry` (admin-only) que agrega
 * `audit_log` + `sponsor_metrics` + `leads` numa janela de N dias.
 *
 * Sem charts complexos: KPIs, listas e CTR.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Search, Eye, MessageCircle, Phone, Target, RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react';
import AdminSponsorRoiPanel from '@/components/sponsors/AdminSponsorRoiPanel';

interface Telemetry {
  window_days: number;
  searches: number;
  searches_today: number;
  zero_result_searches: number;
  profile_views: number;
  profile_views_funnel?: number;
  whatsapp_clicks: number;
  phone_clicks: number;
  leads: number;
  lead_submits?: number;
  sponsor_clicks: number;
  ctr_search_to_view: number;
  ctr_view_to_contact: number;
  ctr_view_to_lead?: number;
  top_terms: { term: string; count: number }[];
  zero_result_terms: { term: string; count: number }[];
  top_categories: { category: string; count: number }[];
  top_cities: { city: string; count: number }[];
  top_providers: { provider_id: string; name: string | null; city: string | null; contacts: number }[];
  top_sponsors: { sponsor_id: string; title: string | null; clicks: number; impressions: number }[];
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <Icon className={`h-5 w-5 ${tone || 'text-foreground'}`} />
        <div>
          <div className={`text-xl font-bold leading-none ${tone || ''}`}>{value}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPublicFunnelPage() {
  const [days, setDays] = useState(7);
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ['public-funnel-telemetry', days],
    queryFn: async (): Promise<Telemetry> => {
      const { data, error } = await supabase.rpc('get_public_funnel_telemetry' as any, { _days: days } as any);
      if (error) throw error;
      return data as Telemetry;
    },
    staleTime: 60_000,
  });

  return (
    <AdminLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">📈 Funil Público — Conversão</h1>
            <p className="text-xs text-muted-foreground">
              Busca → visualização → contato → lead. Dedup 10 min, fire-and-forget. Fase 2.1.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 dia</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/30">
            <CardContent className="py-3 text-sm text-destructive">
              Falha ao carregar telemetria. {(error as Error).message}
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi icon={Search} label="Buscas (janela)" value={data?.searches ?? 0} />
          <Kpi icon={Search} label="Buscas hoje" value={data?.searches_today ?? 0} />
          <Kpi icon={AlertTriangle} label="Sem resultado" value={data?.zero_result_searches ?? 0} tone="text-amber-600 dark:text-amber-400" />
          <Kpi icon={Eye} label="Visualizações" value={data?.profile_views ?? 0} />
          <Kpi icon={MessageCircle} label="Contatos WhatsApp" value={data?.whatsapp_clicks ?? 0} tone="text-emerald-600 dark:text-emerald-400" />
          <Kpi icon={Phone} label="Contatos Telefone" value={data?.phone_clicks ?? 0} />
          <Kpi icon={Target} label="Leads" value={data?.leads ?? 0} tone="text-primary" />
          <Kpi icon={Target} label="Lead submits (funil)" value={data?.lead_submits ?? 0} />
          <Kpi icon={Activity} label="Cliques Sponsors" value={data?.sponsor_clicks ?? 0} />
          <Kpi icon={TrendingUp} label="CTR Busca→Perfil" value={`${data?.ctr_search_to_view ?? 0}%`} tone="text-emerald-600 dark:text-emerald-400" />
          <Kpi icon={TrendingUp} label="CTR Perfil→Contato" value={`${data?.ctr_view_to_contact ?? 0}%`} tone="text-emerald-600 dark:text-emerald-400" />
          <Kpi icon={TrendingUp} label="CTR Perfil→Lead" value={`${data?.ctr_view_to_lead ?? 0}%`} tone="text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Termos mais buscados</CardTitle></CardHeader>
            <CardContent>
              {(data?.top_terms?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Sem buscas com termo registrado.</p>
              ) : (
                <ul className="space-y-1">
                  {data!.top_terms.map((t) => (
                    <li key={t.term} className="flex justify-between text-sm">
                      <span className="truncate">{t.term}</span>
                      <span className="font-mono text-xs">{t.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-300/40">
            <CardHeader><CardTitle className="text-sm">Buscas sem resultado (SEO: demanda reprimida)</CardTitle></CardHeader>
            <CardContent>
              {(data?.zero_result_terms?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma busca sem resultado na janela.</p>
              ) : (
                <ul className="space-y-1">
                  {data!.zero_result_terms.map((t) => (
                    <li key={t.term} className="flex justify-between text-sm">
                      <span className="truncate">{t.term}</span>
                      <span className="font-mono text-xs">{t.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Categorias mais ativas</CardTitle></CardHeader>
            <CardContent>
              {(data?.top_categories?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <ul className="space-y-1">
                  {data!.top_categories.map((c) => (
                    <li key={c.category} className="flex justify-between text-sm">
                      <span className="truncate">{c.category}</span>
                      <span className="font-mono text-xs">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Cidades mais ativas</CardTitle></CardHeader>
            <CardContent>
              {(data?.top_cities?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <ul className="space-y-1">
                  {data!.top_cities.map((c) => (
                    <li key={c.city} className="flex justify-between text-sm">
                      <span className="truncate">{c.city}</span>
                      <span className="font-mono text-xs">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Profissionais com mais contatos</CardTitle></CardHeader>
          <CardContent>
            {(data?.top_providers?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sem contatos registrados.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Profissional</TableHead><TableHead>Cidade</TableHead><TableHead className="text-right">Contatos</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data!.top_providers.map((p) => (
                    <TableRow key={p.provider_id}>
                      <TableCell>
                        <div className="text-sm font-medium">{p.name || '—'}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{p.provider_id}</div>
                      </TableCell>
                      <TableCell className="text-sm">{p.city || '—'}</TableCell>
                      <TableCell className="text-right font-mono">{p.contacts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Sponsors mais clicados</CardTitle></CardHeader>
          <CardContent>
            {(data?.top_sponsors?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sem cliques de sponsor.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Sponsor</TableHead><TableHead className="text-right">Impressões</TableHead><TableHead className="text-right">Cliques</TableHead><TableHead className="text-right">CTR</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data!.top_sponsors.map((s) => {
                    const ctr = s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : '0.00';
                    return (
                      <TableRow key={s.sponsor_id}>
                        <TableCell>
                          <div className="text-sm font-medium">{s.title || '—'}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{s.sponsor_id}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{s.impressions}</TableCell>
                        <TableCell className="text-right font-mono">{s.clicks}</TableCell>
                        <TableCell className="text-right font-mono">{ctr}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Fase 2.3 — ROI sponsor (atribuição leve via sessionStorage) */}
        <div className="pt-2">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" /> ROI Sponsor (atribuição leve)
          </h2>
          <AdminSponsorRoiPanel days={days} />
        </div>
      </div>
    </AdminLayout>
  );
}
