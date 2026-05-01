/** HUD fixo no topo do Bet Mode — placar de pontos com glow + faíscas. */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import DopamineCounter from '@/components/dashboard/DopamineCounter';

interface Props {
  points: number;
  phaseLabel: string;
  progress: number; // 0..1
}

export default function PointsHud({ points, phaseLabel, progress }: Props) {
  const [sparkSeed, setSparkSeed] = useState(0);
  const [lastProgress, setLastProgress] = useState(progress);

  // Dispara faíscas quando a barra avança.
  useEffect(() => {
    if (progress > lastProgress + 0.001) {
      setSparkSeed((s) => s + 1);
    }
    setLastProgress(progress);
  }, [progress, lastProgress]);

  // 8 partículas fixas com offsets aleatórios determinísticos por seed.
  const sparks = Array.from({ length: 8 }, (_, i) => ({
    id: `${sparkSeed}-${i}`,
    x: (Math.sin(sparkSeed * 9.7 + i * 1.3) * 28),
    y: -8 - (i % 3) * 6,
    delay: i * 0.04,
  }));

  const pct = Math.max(0, Math.min(1, progress));

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        <motion.div
          key={points}
          initial={{ scale: 1 }}
          animate={{
            scale: [1, 1.45, 1.1, 1],
            filter: [
              'drop-shadow(0 0 0 rgba(251,191,36,0))',
              'drop-shadow(0 0 18px rgba(251,191,36,0.95))',
              'drop-shadow(0 0 8px rgba(251,191,36,0.55))',
              'drop-shadow(0 0 0 rgba(251,191,36,0))',
            ],
          }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-50 px-3 py-2 shadow-[0_0_24px_rgba(251,191,36,0.55)] dark:border-amber-500/40 dark:from-amber-950/40 dark:via-yellow-900/30 dark:to-amber-950/40"
        >
          <Trophy className="h-5 w-5 text-amber-600 drop-shadow-[0_0_8px_rgba(251,191,36,1)]" />
          <DopamineCounter
            value={points}
            duration={900}
            suffix=" pts"
            className="text-base font-extrabold tabular-nums text-amber-700 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)] dark:text-amber-300"
            celebrateOnComplete={false}
          />
        </motion.div>
        <div className="relative flex-1">
          <div className="flex items-center justify-end text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span aria-hidden className="sr-only">{phaseLabel}</span>
            <span>{Math.round(pct * 100)}%</span>
          </div>
          <div className="relative mt-1 h-1.5 overflow-visible rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 shadow-[0_0_14px_rgba(251,146,60,0.85)]"
            />
            {/* Faíscas no extremo do progresso */}
            <AnimatePresence>
              {sparkSeed > 0 && sparks.map((s) => (
                <motion.span
                  key={s.id}
                  initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  animate={{ opacity: 0, x: s.x, y: s.y, scale: 0.4 }}
                  transition={{ duration: 0.7, delay: s.delay, ease: 'easeOut' }}
                  className="pointer-events-none absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,1)]"
                  style={{ left: `calc(${pct * 100}% - 3px)` }}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
