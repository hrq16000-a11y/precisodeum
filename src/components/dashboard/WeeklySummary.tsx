import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Calendar, Eye, MessageCircle, CheckCircle2, TrendingUp, TrendingDown, Minus,
  Sparkles, Lightbulb, Target,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import GlassCard from '@/components/ui/GlassCard';

interface Metric {
  current: number;
  previous: number;
  delta_pct: number | null;
}
interface SeriesPoint {
  date: string;
  label: string;
  impressions: number;
  whatsapp: number;
  leads: number;
}
interface WeeklyStats {
  available: boolean;
  reason?: string;
  city?: string;
  period_label?: string;
  impressions: Metric;
  profile_views: Metric;
  whatsapp_clicks: Metric;
  leads_closed: Metric;
  series: SeriesPoint[];
}

const num = (m?: Metric) => Number(m?.current ?? 0);

const WeeklySummary = () => {
  const { user, provider } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['weekly-stats', provider?.id],
    enabled: !!provider?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_provider_weekly_stats' as any, {
        _provider_id: provider!.id,
      });
      if (error) throw error;
      return data as unknown as WeeklyStats;
    },
  });

  if (!user?.id || !provider?.id) return null;
  if (isLoading || !data?.available) return null;

  const impressions = num(data.impressions) + num(data.profile_views);
  const views = num(data.profile_views);
  const wa = num(data.whatsapp_clicks);
  const leads = num(data.leads_closed);

  // Variação geral (média ponderada simples — apenas pra cor/copy)
  const overallDelta = avgDelta([
    data.impressions?.delta_pct,
    data.whatsapp_clicks?.delta_pct,
    data.leads_closed?.delta_pct,
  ]);

  const goingUp = overallDelta !== null && overallDelta > 5;
  const goingDown = overallDelta !== null && overallDelta < -5;

  const series = (data.series || []).map((p) => ({
    label: p.label,
    Impressões: p.impressions,
    WhatsApp: p.whatsapp,
    Leads: p.leads,
  }));

  // Conversão (taxa do funil)
  const ctr = impressions > 0 ? Math.round((wa / impressions) * 100) : 0;
  const closeRate = wa > 0 ? Math.round((leads / wa) * 100) : 0;

  return (
    <GlassCard variant="default" className="overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-bold text-foreground">Resumo Semanal de Impacto</h3>
          <p className="text-[11px] text-muted-foreground">
            {data.period_label || 'Últimos 7 dias'}{data.city ? ` · ${data.city}` : ''} · vs semana anterior
          </p>
        </div>
        <DeltaPill value={overallDelta} />
      </div>

      {/* Funil de Sucesso */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <FunnelStep icon={Eye} label="Impressões" value={impressions} delta={data.impressions?.delta_pct} color="hsl(217 91% 60%)" />
        <FunnelStep icon={MessageCircle} label="Cliques WA" value={wa} delta={data.whatsapp_clicks?.delta_pct} color="hsl(142 71% 45%)" />
        <FunnelStep icon={CheckCircle2} label="Concluídos" value={leads} delta={data.leads_closed?.delta_pct} color="hsl(38 92% 50%)" />
      </div>

      {/* Taxas de conversão */}
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
        <ConvBox label="Visualização → Contato" pct={ctr} icon={Target} />
        <ConvBox label="Contato → Conclusão" pct={closeRate} icon={CheckCircle2} />
      </div>

      {/* Gráfico */}
      {series.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-4 h-36 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border) / 0.4)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="Impressões" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="WhatsApp" fill="hsl(142 71% 45%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Leads" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Copy de celebração / sugestão */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-xs ${
          goingUp
            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
            : goingDown
              ? 'border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
              : 'border border-border bg-muted/40 text-foreground'
        }`}
      >
        {goingUp ? (
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : goingDown ? (
          <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <p className="leading-snug">
          {goingUp && (
            <>Sua visibilidade está em alta! 🚀 Continue postando uma <strong>Obra do Dia</strong> para manter o boost de ranking.</>
          )}
          {goingDown && (
            <>Houve uma queda nesta semana. Que tal <strong>postar uma Obra do Dia</strong> ou ficar online no fim da tarde? Quem está online aparece primeiro nas buscas.</>
          )}
          {!goingUp && !goingDown && (
            <>Semana estável. Para acelerar, conclua um lead (+20 pts) ou poste uma Obra do Dia (+0.05 no Recency).</>
          )}
        </p>
      </motion.div>
    </GlassCard>
  );
};

const FunnelStep = ({
  icon: Icon, label, value, delta, color,
}: { icon: any; label: string; value: number; delta: number | null | undefined; color: string }) => (
  <div className="rounded-xl border border-border bg-background/60 p-2.5 text-center">
    <div className="mb-1 flex justify-center">
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <AnimatedCounter value={value} className="block font-display text-lg font-bold leading-none text-foreground" />
    <p className="mt-1 text-[9px] leading-tight text-muted-foreground">{label}</p>
    {delta != null && (
      <span
        className={`mt-1 inline-flex items-center gap-0.5 text-[9px] font-semibold ${
          delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'
        }`}
      >
        {delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : delta < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
        {delta > 0 ? '+' : ''}{delta}%
      </span>
    )}
  </div>
);

const ConvBox = ({ label, pct, icon: Icon }: { label: string; pct: number; icon: any }) => (
  <div className="flex items-center gap-2">
    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground leading-none">{pct}%</p>
    </div>
  </div>
);

const DeltaPill = ({ value }: { value: number | null }) => {
  if (value === null) return null;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        up ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
        flat ? 'bg-muted text-muted-foreground' :
        'bg-red-500/15 text-red-700 dark:text-red-400'
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : flat ? <Minus className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{value}%
    </span>
  );
};

function avgDelta(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

export default WeeklySummary;
