import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Copy, Check, Share2, Gift, Loader2, Trophy, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import GlassCard from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { whatsappLink } from '@/lib/whatsapp';

interface RecentItem {
  id: string;
  status: string;
  reward_points: number;
  created_at: string;
  rewarded_at: string | null;
  referred_name: string;
}
interface Summary {
  available: boolean;
  user_ref: string | null;
  total: number;
  qualified: number;
  points_earned: number;
  recent: RecentItem[];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-muted text-muted-foreground' },
  qualified: { label: 'Qualificado', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  rewarded: { label: 'Recompensado', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  completed: { label: 'Recompensado', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  revoked: { label: 'Revogado', color: 'bg-red-500/15 text-red-700 dark:text-red-400' },
};

export default function ReferralInviteCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const seenRewardedIdsRef = useRef<Set<string> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['referrals-summary', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 90_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_referrals_summary' as any);
      if (error) throw error;
      return data as unknown as Summary;
    },
  });

  // Toast celebrativo: detecta nova indicação que mudou para "rewarded"
  useEffect(() => {
    if (!data?.recent) return;
    const rewardedNow = new Set(
      data.recent
        .filter((r) => r.status === 'rewarded' || r.status === 'completed')
        .map((r) => r.id),
    );
    // primeira passagem: só inicializa o snapshot
    if (seenRewardedIdsRef.current === null) {
      seenRewardedIdsRef.current = rewardedNow;
      return;
    }
    const prev = seenRewardedIdsRef.current;
    const newlyRewarded = [...rewardedNow].filter((id) => !prev.has(id));
    if (newlyRewarded.length > 0) {
      const item = data.recent.find((r) => r.id === newlyRewarded[0]);
      toast.success(
        `${item?.referred_name || 'Seu parceiro'} começou a trabalhar! +50 pontos de engajamento!`,
        {
          duration: 9000,
          icon: '🎉',
          description: 'Motivo: indicação qualificada.',
          action: {
            label: 'Ver histórico',
            onClick: () => {
              if (typeof window !== 'undefined') window.location.assign('/dashboard/indicacoes');
            },
          },
        },
      );
      // invalida pontos de engajamento para refletir o ganho
      queryClient.invalidateQueries({ queryKey: ['engagement-points'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-level'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-ranking'] });
      queryClient.invalidateQueries({ queryKey: ['my-engagement-rank'] });
    }
    seenRewardedIdsRef.current = rewardedNow;
  }, [data, queryClient]);

  if (!user?.id) return null;

  const ref = data?.user_ref;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://precisodeum.com.br';
  const link = ref ? `${origin}/login?ref=${encodeURIComponent(ref)}` : '';
  const message =
    'Tô usando o Preciso de Um pra fechar serviços direto no WhatsApp e ganhar visibilidade. ' +
    'É de graça e você sobe no ranking conforme se engaja. Se cadastra pelo meu link 👉 ' + link;

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

  const handleNativeShare = async () => {
    if (!link) return;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Preciso de Um',
          text: message,
          url: link,
        });
      } catch { /* user cancel */ }
    } else {
      handleCopy();
    }
  };

  return (
    <GlassCard variant="default" className="overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
          <Users className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-bold text-foreground">Convide um Parceiro</h3>
          <p className="text-[11px] text-muted-foreground">
            Indique outro profissional · ganhe <strong className="text-amber-700 dark:text-amber-400">+50 pts</strong> quando ele postar a 1ª Obra do Dia
          </p>
        </div>
        <Link
          to="/dashboard/indicacoes"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
          title="Ver ranking e histórico completo"
        >
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-background/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Users className="h-3 w-3" /> Parceiros indicados
          </div>
          <p className="mt-1 font-display text-xl font-bold text-foreground leading-none">
            {isLoading ? '—' : data?.total ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Trophy className="h-3 w-3" /> Pontos ganhos
          </div>
          <p className="mt-1 font-display text-xl font-bold text-emerald-600 leading-none">
            {isLoading ? '—' : `+${data?.points_earned ?? 0}`}
          </p>
        </div>
      </div>

      {/* Link */}
      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-2">
        {ref ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-[11px] text-foreground" title={link}>
              {link}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-7 gap-1 px-2 text-xs"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Gerando seu link…
          </p>
        )}
      </div>

      {/* CTAs */}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={handleWhatsApp}
          disabled={!ref}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartilhar no WhatsApp
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleNativeShare}
          disabled={!ref}
          className="gap-1.5"
        >
          <Gift className="h-3.5 w-3.5" />
          Outras opções
        </Button>
      </div>

      {/* Recent */}
      {data?.recent && data.recent.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico recente
          </p>
          <div className="space-y-1.5">
            {data.recent.slice(0, 5).map((r) => {
              const meta = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-card/60 px-2 py-1.5"
                >
                  <span className="truncate text-xs text-foreground" title={r.referred_name}>
                    {r.referred_name}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {r.reward_points > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600">+{r.reward_points}</span>
                    )}
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
