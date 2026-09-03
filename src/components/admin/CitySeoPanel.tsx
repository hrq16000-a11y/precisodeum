/**
 * Aba "SEO por cidade" de /admin/seo.
 *
 * Cruza o inventário de páginas programáticas (cidades com profissionais
 * aprovados) com o funil público real (`admin_local_funnel_stats`) para mostrar,
 * por cidade: páginas geradas, profissionais, tráfego orgânico observado,
 * leads, cliques em WhatsApp e CTR.
 *
 * Backlinks e posição média só aparecem quando existe fonte conectada — nunca
 * são estimados. Sem fonte, a coluna mostra "—" (honestidade de dado).
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, ExternalLink, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProgrammaticInventory } from '@/hooks/useProgrammaticInventory';
import { reindexSitemaps } from '@/lib/seo/reindexSitemaps';

const PERIODS = [7, 30, 90] as const;

interface CityRow {
  citySlug: string;
  cityLabel: string;
  state: string | null;
  providers: number;
  cityPages: number;
  hoodPages: number;
  firstPath: string;
  views: number;
  leads: number;
  whatsapp: number;
  ctr: number | null;
  backlinks: number | null;
  avgPosition: number | null;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export default function CitySeoPanel() {
  const { data: inventory = [], isLoading: loadingInv } = useProgrammaticInventory();
  const [days, setDays] = useState<number>(30);
  const [term, setTerm] = useState('');
  const [busyCity, setBusyCity] = useState<string | null>(null);

  const { data: funnel = [], isLoading: loadingFunnel } = useQuery({
    queryKey: ['admin-local-funnel-stats', days],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_local_funnel_stats', { _days: days });
      if (error) throw error;
      return (data || []) as Array<{
        action: string;
        city: string | null;
        events: number;
      }>;
    },
  });

  const rows = useMemo<CityRow[]>(() => {
    const byCity = new Map<string, CityRow>();

    for (const item of inventory) {
      const cur =
        byCity.get(item.citySlug) ||
        ({
          citySlug: item.citySlug,
          cityLabel: item.cityLabel,
          state: item.state,
          providers: 0,
          cityPages: 0,
          hoodPages: 0,
          firstPath: item.path,
          views: 0,
          leads: 0,
          whatsapp: 0,
          ctr: null,
          backlinks: null,
          avgPosition: null,
        } satisfies CityRow);
      if (item.kind === 'cidade') {
        cur.cityPages += 1;
        cur.providers += item.providers;
      } else {
        cur.hoodPages += 1;
      }
      byCity.set(item.citySlug, cur);
    }

    const slugByNorm = new Map<string, string>();
    byCity.forEach((r) => slugByNorm.set(norm(r.cityLabel), r.citySlug));

    for (const f of funnel) {
      if (!f.city) continue;
      const slug = slugByNorm.get(norm(f.city));
      if (!slug) continue;
      const row = byCity.get(slug)!;
      const n = Number(f.events) || 0;
      if (f.action === 'page_view' || f.action === 'city_view' || f.action === 'category_view')
        row.views += n;
      else if (f.action === 'form_submit' || f.action === 'lead_submit') row.leads += n;
      else if (f.action === 'whatsapp_click') row.whatsapp += n;
    }

    byCity.forEach((r) => {
      r.ctr = r.views > 0 ? (r.leads + r.whatsapp) / r.views : null;
    });

    const list = [...byCity.values()];
    const q = norm(term);
    const filtered = q ? list.filter((r) => norm(r.cityLabel).includes(q)) : list;
    return filtered.sort((a, b) => b.views - a.views || b.providers - a.providers);
  }, [inventory, funnel, term]);

  const isLoading = loadingInv || loadingFunnel;

  const submitCity = async (row: CityRow) => {
    setBusyCity(row.citySlug);
    const res = await reindexSitemaps({ silent: true });
    setBusyCity(null);
    if (res.ok) toast.success(`Sitemap reenviado ao Google (cobre ${row.cityLabel})`);
    else toast.error(res.error || 'Falha ao submeter o sitemap');
  };

  const exportCsv = () => {
    const header = [
      'cidade',
      'uf',
      'profissionais',
      'paginas_cidade',
      'paginas_bairro',
      'organico_views',
      'leads',
      'whatsapp',
      'ctr',
      'backlinks',
      'posicao_media',
    ].join(',');
    const body = rows
      .map((r) =>
        [
          `"${r.cityLabel}"`,
          r.state ?? '',
          r.providers,
          r.cityPages,
          r.hoodPages,
          r.views,
          r.leads,
          r.whatsapp,
          r.ctr == null ? '' : (r.ctr * 100).toFixed(1),
          r.backlinks ?? '',
          r.avgPosition ?? '',
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-por-cidade-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">SEO por cidade</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={days === p ? 'default' : 'outline'}
                onClick={() => setDays(p)}
              >
                {p}d
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5">
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => reindexSitemaps()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Reindexar tudo
            </Button>
          </div>
        </div>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Filtrar por cidade"
          className="max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          Orgânico, leads e cliques vêm do funil público real da plataforma. Backlinks e posição
          média aparecem como “—” enquanto não houver fonte de dados conectada — nada é estimado.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-md" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma cidade com profissionais aprovados encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Cidade</th>
                  <th className="py-2 pr-3">Páginas</th>
                  <th className="py-2 pr-3">Profissionais</th>
                  <th className="py-2 pr-3">Orgânico</th>
                  <th className="py-2 pr-3">Leads</th>
                  <th className="py-2 pr-3">WhatsApp</th>
                  <th className="py-2 pr-3">CTR</th>
                  <th className="py-2 pr-3">Backlinks</th>
                  <th className="py-2 pr-3">Posição</th>
                  <th className="py-2 pr-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.citySlug} className="border-t border-border/60">
                    <td className="py-2 pr-3 font-medium">
                      {r.cityLabel}
                      {r.state ? (
                        <span className="ml-1 text-xs text-muted-foreground">{r.state}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary">{r.cityPages} cidade</Badge>{' '}
                      <Badge variant="outline">{r.hoodPages} bairro</Badge>
                    </td>
                    <td className="py-2 pr-3">{r.providers}</td>
                    <td className="py-2 pr-3">{r.views}</td>
                    <td className="py-2 pr-3">{r.leads}</td>
                    <td className="py-2 pr-3">{r.whatsapp}</td>
                    <td className="py-2 pr-3">
                      {r.ctr == null ? '—' : `${(r.ctr * 100).toFixed(1)}%`}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {r.backlinks ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {r.avgPosition ?? '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={busyCity === r.citySlug}
                          onClick={() => submitCity(r)}
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden />
                          Submeter
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={r.firstPath} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
