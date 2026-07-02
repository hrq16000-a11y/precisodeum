import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, MapPin } from 'lucide-react';
import { format } from 'date-fns';

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

export default function CoverageSearchStatsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['coverage_search_log_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coverage_search_log' as any)
        .select('id, lat, lng, radius_m, category_slug, city_hint, result_count, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });

  const rows = data || [];

  // Aggregate by approximate region (lat/lng rounded to 1 decimal ~ 11km bucket).
  const regions = new Map<string, { count: number; lat: number; lng: number; city: string | null }>();
  const categories = new Map<string, number>();
  for (const r of rows) {
    const key = `${round(r.lat, 1)}_${round(r.lng, 1)}`;
    const cur = regions.get(key) || { count: 0, lat: round(r.lat, 1), lng: round(r.lng, 1), city: r.city_hint };
    cur.count += 1;
    if (!cur.city && r.city_hint) cur.city = r.city_hint;
    regions.set(key, cur);
    if (r.category_slug) categories.set(r.category_slug, (categories.get(r.category_slug) || 0) + 1);
  }
  const topRegions = [...regions.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  const topCategories = [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Inteligência de demanda — últimas 200 buscas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma busca registrada ainda.</p>
        )}
        {rows.length > 0 && (
          <>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Regiões mais buscadas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {topRegions.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {r.city || `${r.lat.toFixed(1)}, ${r.lng.toFixed(1)}`}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{r.count}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {topCategories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Categorias mais buscadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {topCategories.map(([slug, n]) => (
                    <Badge key={slug} variant="secondary" className="text-[10px]">{slug} · {n}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Últimas requisições</p>
              <div className="max-h-48 overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1">Quando</th>
                      <th className="px-2 py-1">Coord.</th>
                      <th className="px-2 py-1">Raio</th>
                      <th className="px-2 py-1">Categoria</th>
                      <th className="px-2 py-1">Result.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 30).map((r: any) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), 'dd/MM HH:mm')}</td>
                        <td className="px-2 py-1">{round(r.lat, 2)}, {round(r.lng, 2)}</td>
                        <td className="px-2 py-1">{r.radius_m ? `${Math.round(r.radius_m / 1000)} km` : '—'}</td>
                        <td className="px-2 py-1">{r.category_slug || '—'}</td>
                        <td className="px-2 py-1">{r.result_count ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
