import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, Eye, MessageCircle, Target, TrendingUp, TrendingDown, Minus, Trophy, Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

interface WeeklyData {
  available: boolean;
  views: number;
  whatsapp_clicks: number;
  leads: number;
  rank_current: number | null;
  rank_change: number;
  top_competitor_leads: number;
  top_competitor_name: string | null;
  city: string;
}

const WeeklySummary = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['weekly-summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: result, error } = await supabase.rpc('get_weekly_summary' as any, { _user_id: user.id });
      if (error) throw error;
      return result as unknown as WeeklyData;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data?.available) return null;

  const rankUp = data.rank_change > 0;
  const rankDown = data.rank_change < 0;
  const rankSame = data.rank_change === 0;

  // FOMO comparison: how far behind top competitor
  const gap = Math.max(0, (data.top_competitor_leads || 0) - (data.leads || 0));
  const isLeader = gap === 0 && data.leads > 0 && data.top_competitor_name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5 relative overflow-hidden"
    >
      {/* Glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl bg-primary/10" />

      {/* Header */}
      <div className="relative flex items-center gap-2.5 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-bold text-foreground">Resumo da Semana</h3>
          <p className="text-[11px] text-muted-foreground">Últimos 7 dias{data.city ? ` em ${data.city}` : ''}</p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="relative grid grid-cols-3 gap-2.5">
        <StatBox icon={Eye} value={data.views} label="Visualizações" color="hsl(217 91% 60%)" />
        <StatBox icon={MessageCircle} value={data.whatsapp_clicks} label="Cliques WhatsApp" color="hsl(142 71% 45%)" />
        <StatBox icon={Target} value={data.leads} label="Leads" color="hsl(38 92% 50%)" />
      </div>

      {/* Ranking change */}
      {data.rank_current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative mt-3 flex items-center gap-2.5 rounded-xl border border-border bg-background/60 p-3"
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            rankUp ? 'bg-emerald-500/15 text-emerald-600' :
            rankDown ? 'bg-red-500/15 text-red-600' :
            'bg-muted text-muted-foreground'
          }`}>
            {rankUp ? <TrendingUp className="h-4 w-4" /> : rankDown ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground">
              Posição #{data.rank_current} no ranking local
            </p>
            <p className="text-[11px] text-muted-foreground">
              {rankUp && <>Você subiu <strong className="text-emerald-600">{Math.abs(data.rank_change)}</strong> posição{Math.abs(data.rank_change) !== 1 ? 'ões' : ''} esta semana</>}
              {rankDown && <>Você caiu <strong className="text-red-600">{Math.abs(data.rank_change)}</strong> posição{Math.abs(data.rank_change) !== 1 ? 'ões' : ''} — recupere!</>}
              {rankSame && 'Posição estável — engaje mais para subir'}
            </p>
          </div>
        </motion.div>
      )}

      {/* FOMO competitor comparison */}
      {(gap > 0 || isLeader) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={`relative mt-2.5 flex items-start gap-2.5 rounded-xl p-3 ${
            isLeader
              ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30'
              : 'bg-accent/5 border border-accent/20'
          }`}
        >
          {isLeader ? (
            <Trophy className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <Flame className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          )}
          <p className="text-[11px] text-foreground leading-snug">
            {isLeader ? (
              <>Você é o <strong className="text-amber-600">profissional #1</strong> da sua região esta semana. Mantenha o ritmo.</>
            ) : (
              <>O top profissional da sua região recebeu <strong className="text-accent">{data.top_competitor_leads} lead{data.top_competitor_leads !== 1 ? 's' : ''}</strong> esta semana. Faltam <strong className="text-foreground">{gap}</strong> para você ultrapassar.</>
            )}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

const StatBox = ({ icon: Icon, value, label, color }: { icon: any; value: number; label: string; color: string }) => (
  <div className="rounded-xl border border-border bg-background/60 p-2.5 text-center">
    <div className="flex justify-center mb-1">
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <AnimatedCounter value={value} className="font-display text-lg font-bold text-foreground block leading-none" />
    <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{label}</p>
  </div>
);

export default WeeklySummary;
