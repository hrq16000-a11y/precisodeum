import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  Trophy,
  Share2,
  Copy,
  Check,
  ArrowLeft,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { whatsappLink } from '@/lib/whatsapp';
import { useSeoHead } from '@/hooks/useSeoHead';
import ReferralPointsEvolution from '@/components/dashboard/ReferralPointsEvolution';

interface Item {
  id: string;
  status: string;
  reward_points: number;
  created_at: string;
  qualified_at: string | null;
  rewarded_at: string | null;
  referred_name: string;
  referred_city: string | null;
  referred_state: string | null;
  referred_account_type: string | null;
}

interface PointsLogEntry {
  id: string;
  points: number;
  action_key: string;
  created_at: string;
  metadata: any;
}

interface FullData {
  available: boolean;
  user_ref: string | null;
  totals: {
    total: number;
    pending: number;
    qualified: number;
    rewarded: number;
    revoked: number;
    points_earned: number;
  };
  items: Item[];
  points_log: PointsLogEntry[];
  rank: number | null;
  rank_total: number | null;
}

const STATUS_META: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  pending: { label: 'Aguardando', bg: 'bg-muted', text: 'text-muted-foreground', icon: Clock },
  qualified: { label: 'Qualificado', bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', icon: Sparkles },
  rewarded: { label: 'Recompensado', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  completed: { label: 'Recompensado', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  revoked: { label: 'Revogado', bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400', icon: XCircle },
};

type FilterKey = 'all' | 'pending' | 'qualified' | 'rewarded';

const PAGE_SIZE = 8;

export default function DashboardReferralsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);

  useSeoHead({
    title: 'Minhas Indicações · Preciso de Um',
    description: 'Acompanhe seu ranking, status de cada indicação e o histórico de pontos creditados.',
    noindex: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['referrals-full', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_referrals_full' as any);
      if (error) throw error;
      return data as unknown as FullData;
    },
  });

  const ref = data?.user_ref;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://precisodeum.com.br';
  const link = ref ? `${origin}/login?ref=${encodeURIComponent(ref)}` : '';
  const message = `Olá! Estou usando o Preciso de Um para ganhar mais clientes. Cadastre-se pelo meu link e ganhe destaque no ranking: ${link}`;

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const handleWhatsApp = () => {
    if (!link) return;
    window.open(whatsappLink('', message), '_blank', 'noopener,noreferrer');
  };

  const filteredItems = useMemo(() => {
    const items = data?.items || [];
    if (filter === 'all') return items;
    if (filter === 'rewarded') return items.filter((i) => i.status === 'rewarded' || i.status === 'completed');
    return items.filter((i) => i.status === filter);
  }, [data, filter]);

  // Reset paginação quando o filtro muda
  useMemo(() => { setPage(1); }, [filter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pagedItems = useMemo(
    () => filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredItems, page]
  );

  const totals = data?.totals;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5 px-3 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Minhas Indicações</h1>
            <p className="text-xs text-muted-foreground">
              Acompanhe seus parceiros, status e pontos creditados.
            </p>
          </div>
        </div>

        {/* Ranking + totals */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-amber-500" /> Ranking
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">
              {isLoading ? '—' : data?.rank ? `#${data.rank}` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {data?.rank_total ? `entre ${data.rank_total} indicadores ativos` : 'Indique para entrar no ranking'}
            </p>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Total indicados
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">{totals?.total ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">
              {totals?.qualified ?? 0} qualificados
            </p>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Recompensados
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-emerald-600">{totals?.rewarded ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">parceiros que postaram a 1ª Obra</p>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Award className="h-3.5 w-3.5 text-violet-600" /> Pontos ganhos
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-violet-600">+{totals?.points_earned ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">via indicações qualificadas</p>
          </GlassCard>
        </div>

        {/* Link section */}
        <GlassCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Seu link único de indicação
              </label>
              <Input value={link} readOnly className="font-mono text-xs" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCopy} variant="outline" size="sm" disabled={!link} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
              <Button
                onClick={handleWhatsApp}
                size="sm"
                disabled={!link}
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Share2 className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            O bônus de <strong className="text-violet-600">+50 pontos</strong> é creditado automaticamente assim que o seu parceiro postar a primeira <em>Obra do Dia</em>.
          </p>
        </GlassCard>

        {/* Filters + paginated history list */}
        <GlassCard className="p-4" id="historico">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <TrendingUp className="h-4 w-4" /> Histórico de indicações
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {filteredItems.length} {filteredItems.length === 1 ? 'indicação' : 'indicações'}
                {filter !== 'all' && ` em ${STATUS_META[filter]?.label?.toLowerCase()}`}
              </p>
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {(['all', 'pending', 'qualified', 'rewarded'] as FilterKey[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    filter === f
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {f === 'all' ? 'Todos' : STATUS_META[f]?.label || f}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium text-foreground">Nenhuma indicação por aqui ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Compartilhe seu link e seus pontos começam a subir.
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {pagedItems.map((item) => {
                  const meta = STATUS_META[item.status] || STATUS_META.pending;
                  const Icon = meta.icon;
                  const location = [item.referred_city, item.referred_state].filter(Boolean).join(', ');
                  const fmt = (d: string | null) =>
                    d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;
                  return (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{item.referred_name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {location || 'Localização não informada'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span>Indicado <strong className="text-foreground/80">{fmt(item.created_at)}</strong></span>
                          {item.qualified_at && (
                            <span>Qualificado <strong className="text-blue-600">{fmt(item.qualified_at)}</strong></span>
                          )}
                          {item.rewarded_at && (
                            <span>Pontos creditados <strong className="text-emerald-600">{fmt(item.rewarded_at)}</strong></span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                        {item.reward_points > 0 && (
                          <span className="text-sm font-bold text-emerald-600">+{item.reward_points}</span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.bg} ${meta.text}`}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md border border-border bg-background px-3 py-1 font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-muted-foreground">
                    Página <strong className="text-foreground">{page}</strong> de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-md border border-border bg-background px-3 py-1 font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </>
          )}
        </GlassCard>

        {/* Evolução dos pontos no tempo (gráfico + filtros + top indicações) */}
        <div id="evolucao" className="scroll-mt-20">
          <ReferralPointsEvolution />
        </div>

        {/* Points history (engagement_log) */}
        <GlassCard className="p-4" id="creditos">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Award className="h-4 w-4 text-violet-600" /> Histórico de pontos creditados
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : !data?.points_log?.length ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Nenhum ponto creditado por indicações ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.points_log.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Indicação qualificada</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-emerald-600">+{entry.points}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
