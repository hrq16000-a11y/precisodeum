import { motion } from 'framer-motion';
import { Zap, Sparkles } from 'lucide-react';
import { useProviderActivity } from '@/hooks/useProviderActivity';
import { useIsProviderOnline } from '@/hooks/useOnlinePresence';
import { cn } from '@/lib/utils';

interface Props {
  userId?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Badges públicos de "Trabalhando agora" / "Ativo hoje" — exibidos no
 * /profissional/:slug e em outras superfícies públicas.
 *
 * Prioridade visual:
 *  1. Trabalhando agora (heartbeat ativo OU presença online)
 *  2. Ativo hoje (post / lead recente)
 */
const PublicActivityBadges = ({ userId, size = 'sm', className }: Props) => {
  const { data } = useProviderActivity(userId || undefined);
  const isOnline = useIsProviderOnline(userId || undefined);

  if (!userId) return null;

  const workingNow = !!data?.working_now || isOnline;
  const activeToday = !!data?.active_today;

  if (!workingNow && !activeToday) return null;

  const sizeCls =
    size === 'md'
      ? 'text-xs px-2.5 py-1 gap-1.5'
      : 'text-[11px] px-2 py-0.5 gap-1';

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {workingNow ? (
        <motion.span
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'relative inline-flex items-center rounded-full font-semibold',
            'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            sizeCls,
          )}
          aria-label="Trabalhando agora"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Trabalhando agora
        </motion.span>
      ) : activeToday ? (
        <motion.span
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'inline-flex items-center rounded-full font-semibold',
            'border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
            sizeCls,
          )}
          aria-label="Ativo hoje"
        >
          <Sparkles className="h-3 w-3" />
          Ativo hoje
        </motion.span>
      ) : null}

      {/* Quando os dois sinais estiverem presentes, mostra também o complementar */}
      {workingNow && activeToday && (
        <span
          className={cn(
            'inline-flex items-center rounded-full font-medium text-muted-foreground',
            'border bg-background',
            sizeCls,
          )}
        >
          <Zap className="h-3 w-3" />
          Ativo hoje
        </span>
      )}
    </div>
  );
};

export default PublicActivityBadges;
