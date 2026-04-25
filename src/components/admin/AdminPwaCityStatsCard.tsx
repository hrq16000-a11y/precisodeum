import { useQuery } from '@tanstack/react-query';
import { Smartphone, MapPin, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CityStat {
  city: string;
  total_providers: number;
  installed_providers: number;
  install_rate: number;
}

const HIGHLIGHT_CITIES = ['curitiba', 'são josé dos pinhais', 'sao jose dos pinhais'];

const isHighlight = (city: string) =>
  HIGHLIGHT_CITIES.includes(city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

/**
 * Card admin: % de profissionais por cidade que já abriram o app no modo
 * instalado (PWA). Curitiba e São José dos Pinhais aparecem destacados.
 *
 * Fonte: RPC admin_pwa_install_stats_by_city (somente admins).
 */
const AdminPwaCityStatsCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-pwa-stats-by-city'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_pwa_install_stats_by_city' as any);
      if (error) throw error;
      return (data || []) as unknown as CityStat[];
    },
  });

  const highlights = (data || []).filter((d) => isHighlight(d.city));
  const others = (data || []).filter((d) => !isHighlight(d.city)).slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4" />
          Adoção do App por Cidade
        </CardTitle>
        <CardDescription>
          Percentual de profissionais que já abriram a versão instalada (PWA).
          Curitiba e São José dos Pinhais ficam em destaque.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sem dados de instalação ainda. Eventos são registrados no audit_log
            quando o app é aberto em modo standalone.
          </p>
        ) : (
          <>
            {highlights.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold text-primary">
                  <TrendingUp className="h-3 w-3" />
                  Cidades-foco
                </div>
                {highlights.map((row) => (
                  <CityRow key={row.city} row={row} highlight />
                ))}
              </div>
            )}
            {others.length > 0 && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Outras cidades
                </div>
                {others.map((row) => (
                  <CityRow key={row.city} row={row} />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const CityRow = ({ row, highlight }: { row: CityStat; highlight?: boolean }) => (
  <div className={cn('space-y-1.5', highlight && 'rounded-lg bg-primary/5 p-2 -m-2')}>
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium truncate">{row.city}</span>
        {highlight && <Badge variant="secondary" className="text-[10px]">foco</Badge>}
      </div>
      <div className="text-right shrink-0 tabular-nums">
        <span className="font-bold">{row.install_rate}%</span>
        <span className="text-xs text-muted-foreground ml-2">
          {row.installed_providers}/{row.total_providers}
        </span>
      </div>
    </div>
    <Progress value={Number(row.install_rate)} className="h-1.5" />
  </div>
);

export default AdminPwaCityStatsCard;
