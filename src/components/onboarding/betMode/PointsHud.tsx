/** HUD fixo no topo do Bet Mode — placar de pontos com glow. */
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import DopamineCounter from '@/components/dashboard/DopamineCounter';

interface Props {
  points: number;
  phaseLabel: string;
  progress: number; // 0..1
}

export default function PointsHud({ points, phaseLabel, progress }: Props) {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        <motion.div
          key={points}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 0.45 }}
          className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-50 px-3 py-2 shadow-[0_0_20px_rgba(251,191,36,0.45)] dark:border-amber-500/40 dark:from-amber-950/40 dark:via-yellow-900/30 dark:to-amber-950/40"
        >
          <Trophy className="h-5 w-5 text-amber-600 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
          <DopamineCounter
            value={points}
            duration={900}
            suffix=" pts"
            className="text-base font-extrabold tabular-nums text-amber-700 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] dark:text-amber-300"
            celebrateOnComplete={false}
          />
        </motion.div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>{phaseLabel}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 shadow-[0_0_12px_rgba(251,146,60,0.7)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
