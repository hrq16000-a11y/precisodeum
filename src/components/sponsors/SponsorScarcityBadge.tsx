import { Flame, TrendingUp } from 'lucide-react';
import { useRemainingSlots } from '@/hooks/useSponsors';

interface Props {
  type: 'global' | 'city' | 'category';
  contextValue?: string;
  className?: string;
}

const SponsorScarcityBadge = ({ type, contextValue, className = '' }: Props) => {
  const { remaining, maxSlots } = useRemainingSlots(type, contextValue);

  const label = type === 'global' ? 'premium global' : type === 'city' ? 'nesta cidade' : 'nesta categoria';

  // High demand / all taken — show opportunity, not "sold out"
  if (maxSlots === 0 || remaining === 0) {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary animate-pulse-soft-slow ${className}`}
      >
        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
        Alta demanda {label} — garanta seu espaço!
      </div>
    );
  }

  if (remaining === 1) {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 animate-pulse-soft ${className}`}
      >
        <Flame className="h-3.5 w-3.5" aria-hidden="true" />
        Última vaga disponível {label}!
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary ${className}`}>
      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
      Restam {remaining} vagas {label}
    </div>
  );
};

export default SponsorScarcityBadge;
