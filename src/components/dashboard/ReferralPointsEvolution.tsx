import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Loader2, Trophy, ArrowRight } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Period = 7 | 30 | 90;

interface TimelineData {
  available: boolean;
  period_days: number;
  total_points: number;
  daily: Array<{ date: string; points: number }>;
  top_referrals: Array<{
    id: string;
    points: number;
    event_at: string;
    referred_name: string | null;
    referred_user_ref: string | null;
  }>;
}

const PERIOD_LABEL: Record<Period, string> = {
  7: '7 dias',
  30: '30 dias',
  90: '90 dias',
};

export default function ReferralPointsEvolution() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>(30);

  const { data, isLoading } = useQuery({
    queryKey: ['referrals-points-timeline', user?.id, period],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_my_referral_points_timeline' as any,
        { _period_days: period }
      );
      if (error) throw error;
      return data as unknown as TimelineData;
    },
  });

  const chartData = useMemo(
    () =>
      (data?.daily || []).map((d) => ({
        date: d.date,
        label: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        points: d.points,
      })),
    [data]
  );

  const peak = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.max(...chartData.map((d) => d.points));
  }, [chartData]);

  return (
    <GlassCard className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          <TrendingUp className="h-4 w-4 text-emerald-600" /> Evolução dos pontos por indicação
        </h2>
        <div className="flex gap-1">
          {([7, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                period === p
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total no período</p>
          <p className="font-display text-lg font-bold text-emerald-600">
            +{data?.total_points ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pico em 1 dia</p>
          <p className="font-display text-lg font-bold text-foreground">
            +{peak}
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-[180px] w-full">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : chartData.length === 0 || (data?.total_points ?? 0) === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <TrendingUp className="h-6 w-6 text-muted-foreground/50" />
            <p className="mt-1.5 text-sm font-medium text-foreground">Sem pontos creditados ainda</p>
            <p className="text-[11px] text-muted-foreground">
              Compartilhe seu link para ver o gráfico evoluir.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="refPointsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                interval={Math.max(0, Math.floor(chartData.length / 7))}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`+${v} pts`, 'Pontos']}
              />
              <Area
                type="monotone"
                dataKey="points"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#refPointsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top indicações que mais pontuaram */}
      {data?.top_referrals && data.top_referrals.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              Top indicações do período
            </h3>
            <Link
              to="/dashboard/indicacoes#historico"
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline"
            >
              Ver tudo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {data.top_referrals.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {t.referred_name || 'Profissional'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(t.event_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-600">+{t.points}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}
