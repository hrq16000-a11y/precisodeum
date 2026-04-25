import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Star, ArrowUpRight, Sparkles } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead } from '@/hooks/useSeoHead';
import { cn } from '@/lib/utils';

type Period = 7 | 30 | 90;

interface RankingRow {
  rank_position: number;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  business_name: string | null;
  city: string | null;
  state: string | null;
  total_points: number;
  is_me: boolean;
}

interface MyRank {
  rank_position: number;
  total_points: number;
  total_participants: number;
}

const PERIOD_LABEL: Record<Period, string> = {
  7: 'Últimos 7 dias',
  30: 'Últimos 30 dias',
  90: 'Últimos 90 dias',
};

const initials = (name?: string | null) =>
  (name || 'P').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

const DashboardRankingPage = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>(30);

  useSeoHead({
    title: 'Ranking de Profissionais — Preciso de Um',
    description: 'Veja o ranking de profissionais por pontos de engajamento e descubra sua posição entre os destaques da semana, do mês e do trimestre.',
    noindex: true,
  });

  const { data: ranking, isLoading } = useQuery({
    queryKey: ['engagement-ranking', period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_engagement_ranking' as any, {
        _period_days: period,
        _limit: 100,
      });
      if (error) throw error;
      return (data || []) as unknown as RankingRow[];
    },
  });

  const { data: myRank } = useQuery({
    queryKey: ['my-engagement-rank', period, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_engagement_rank' as any, {
        _period_days: period,
      });
      if (error) throw error;
      const rows = (data || []) as unknown as MyRank[];
      return rows[0] || null;
    },
  });

  const myRowInTop = useMemo(
    () => ranking?.find((r) => r.is_me),
    [ranking]
  );

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
              <span>/</span>
              <span>Ranking</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-7 w-7 text-amber-500" />
              Ranking de Engajamento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Posição calculada por pontos acumulados no período. Suba postando, fechando leads e indicando parceiros.
            </p>
          </div>

          {/* Filtros de período */}
          <div className="flex flex-wrap gap-2 mb-6">
            {([7, 30, 90] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABEL[p]}
              </Button>
            ))}
          </div>

          {/* Minha posição em destaque */}
          {myRank ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-5 mb-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">#{myRank.rank_position}</span>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Sua posição</p>
                      <p className="text-lg font-bold">
                        {myRank.rank_position}º de {myRank.total_participants}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {myRank.total_points.toLocaleString('pt-BR')} pontos no período
                      </p>
                    </div>
                  </div>
                  <Link to="/dashboard/indicacoes">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Ganhar +50 indicando
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ) : (
            !isLoading && (
              <Card className="p-5 mb-6 border-dashed">
                <div className="flex items-start gap-3">
                  <Star className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-semibold">Você ainda não pontuou no período</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Poste uma Obra do Dia, feche um lead ou{' '}
                      <Link to="/dashboard/indicacoes" className="text-primary underline">
                        indique um parceiro
                      </Link>{' '}
                      para entrar no ranking.
                    </p>
                  </div>
                </div>
              </Card>
            )
          )}

          {/* Top 100 */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h2 className="font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                Top {ranking?.length || 100} — {PERIOD_LABEL[period]}
              </h2>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !ranking || ranking.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Sem dados no período. Volte em breve!
              </div>
            ) : (
              <ul className="divide-y">
                {ranking.map((row) => (
                  <RankRow key={row.user_id} row={row} highlight={row.is_me} />
                ))}
              </ul>
            )}
          </Card>

          {/* Se eu não estiver no top, mostra rodapé com link */}
          {myRank && !myRowInTop && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Sua posição (#{myRank.rank_position}) está fora do Top {ranking?.length}. Continue pontuando!
            </div>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
};

const RankRow = ({ row, highlight }: { row: RankingRow; highlight: boolean }) => {
  const displayName = row.business_name || row.full_name || 'Profissional';
  const location = [row.city, row.state].filter(Boolean).join(' / ');
  const isPodium = row.rank_position <= 3;

  return (
    <li
      className={cn(
        'flex items-center gap-3 p-3 transition-colors',
        highlight ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/50',
      )}
    >
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-sm',
        row.rank_position === 1 && 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
        row.rank_position === 2 && 'bg-slate-400/20 text-slate-700 dark:text-slate-300',
        row.rank_position === 3 && 'bg-orange-700/20 text-orange-800 dark:text-orange-400',
        !isPodium && 'bg-muted text-muted-foreground',
      )}>
        {isPodium ? <Medal className="h-4 w-4" /> : `${row.rank_position}`}
      </div>

      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={row.avatar_url || undefined} alt={displayName} />
        <AvatarFallback>{initials(displayName)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          {highlight && <Badge variant="secondary" className="text-[10px]">Você</Badge>}
        </div>
        {location && <p className="text-xs text-muted-foreground truncate">{location}</p>}
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{row.total_points.toLocaleString('pt-BR')}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">pontos</p>
      </div>

      {row.slug && (
        <Link
          to={`/profissional/${row.slug}`}
          className="ml-1 text-muted-foreground hover:text-primary transition-colors"
          aria-label="Ver perfil"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
    </li>
  );
};

export default DashboardRankingPage;
