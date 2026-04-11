import { Star, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReviewSummaryProps {
  rating: number;
  reviewCount: number;
  compact?: boolean;
  delay?: number;
}

type RankTier = { label: string; color: string; bg: string; border: string } | null;

function getRankTier(rating: number, reviewCount: number): RankTier {
  if (rating >= 4.8 && reviewCount >= 10) return { label: 'Top Rated', color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-300' };
  if (rating >= 4.5 && reviewCount >= 5) return { label: 'Bem Avaliado', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-300' };
  if (rating >= 4.0 && reviewCount >= 3) return { label: 'Recomendado', color: 'text-amber-800', bg: 'bg-orange-50', border: 'border-orange-200' };
  return null;
}

const ReviewSummary = ({ rating, reviewCount, compact = false, delay = 0.3 }: ReviewSummaryProps) => {
  if (reviewCount <= 0) return null;

  const tier = getRankTier(rating, reviewCount);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} className={`h-3 w-3 ${s <= Math.round(rating) ? 'fill-accent text-accent' : 'text-muted-foreground/20'}`} />
          ))}
        </div>
        <span className="text-xs font-bold text-foreground">{rating.toFixed(1)}</span>
        <span className="text-[10px] text-muted-foreground">({reviewCount})</span>
        {tier && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tier.bg} ${tier.color} border ${tier.border}`}>
            <Trophy className="h-2.5 w-2.5" /> {tier.label}
          </span>
        )}
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-wrap items-center gap-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <span className="text-3xl font-bold text-foreground leading-none">{rating.toFixed(1)}</span>
      <div>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} className={`h-4 w-4 ${s <= Math.round(rating) ? 'fill-accent text-accent' : 'text-muted-foreground/20'}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{reviewCount} {reviewCount === 1 ? 'avaliação' : 'avaliações'}</p>
      </div>
      {tier && (
        <motion.span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tier.bg} ${tier.color} border ${tier.border}`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.2, type: 'spring', stiffness: 300 }}
        >
          <Trophy className="h-3 w-3" /> {tier.label}
        </motion.span>
      )}
    </motion.div>
  );
};

export { getRankTier };
export default ReviewSummary;
