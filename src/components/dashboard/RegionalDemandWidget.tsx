import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MapPin, TrendingUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import GlassCard from '@/components/ui/GlassCard';

interface DemandRow {
  location_label: string;
  city: string | null;
  neighborhood: string | null;
  search_count: number;
}

/**
 * "Onde estão os Clientes?" — top regiões com mais buscas na categoria do
 * profissional (últimos 30 dias). Usa RPC get_search_demand_stats.
 */
export default function RegionalDemandWidget() {
  const { provider } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['regional-demand', provider?.id],
    enabled: !!provider?.id,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_search_demand_stats' as any, {
        _provider_id: provider!.id,
      });
      if (error) throw error;
      return (data || []) as DemandRow[];
    },
  });

  const rows = data || [];
  const max = rows.length > 0 ? Math.max(...rows.map(r => Number(r.search_count) || 0), 1) : 1;

  return (
    <GlassCard variant="default" className="overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-base font-bold text-foreground">Onde estão os Clientes?</h3>
          <p className="text-xs text-muted-foreground">Regiões com mais buscas na sua categoria · últimos 30 dias</p>
        </div>
        <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && (
          <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando dados de demanda…
          </div>
        )}

        {!isLoading && error && (
          <p className="text-xs text-destructive">Não foi possível carregar a demanda agora.</p>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Ainda não há buscas registradas na sua categoria. Assim que clientes começarem a procurar, você verá aqui as regiões mais quentes.
          </p>
        )}

        {rows.map((r, i) => {
          const pct = Math.round((Number(r.search_count) / max) * 100);
          return (
            <motion.div
              key={`${r.location_label}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg border border-border/60 bg-card/60 p-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    {i + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground" title={r.location_label}>
                    {r.location_label}
                  </span>
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {Number(r.search_count).toLocaleString('pt-BR')} buscas
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.05 }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
}
