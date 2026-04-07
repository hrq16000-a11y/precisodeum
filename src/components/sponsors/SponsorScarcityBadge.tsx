import { motion } from 'framer-motion';
import { AlertTriangle, Flame } from 'lucide-react';
import { useRemainingSlots } from '@/hooks/useSponsors';

interface Props {
  type: 'global' | 'city' | 'category';
  contextValue?: string;
  className?: string;
}

const SponsorScarcityBadge = ({ type, contextValue, className = '' }: Props) => {
  const { remaining, isFull, maxSlots } = useRemainingSlots(type, contextValue);

  if (maxSlots === 0) return null;

  const label = type === 'global' ? 'premium global' : type === 'city' ? 'nesta cidade' : 'nesta categoria';

  if (isFull) {
    return (
      <div className={`flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive ${className}`}>
        <AlertTriangle className="h-3.5 w-3.5" />
        Sem vagas disponíveis {label}
      </div>
    );
  }

  if (remaining === 1) {
    return (
      <motion.div
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" as const }}
        className={`flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 ${className}`}
      >
        <Flame className="h-3.5 w-3.5" />
        Última vaga disponível {label}!
      </motion.div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary ${className}`}>
      <Flame className="h-3.5 w-3.5" />
      Restam {remaining} vagas {label}
    </div>
  );
};

export default SponsorScarcityBadge;
