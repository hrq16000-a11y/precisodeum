/** Phase Celebration — confete mega + total de pontos + CTA. */
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Rocket } from 'lucide-react';
import DopamineCounter from '@/components/dashboard/DopamineCounter';
import { Button } from '@/components/ui/button';
import { stageWin } from '@/lib/betDopamine';

interface Props {
  totalPoints: number;
  ctaLabel: string;
  onCta: () => void;
}

export default function PhaseCelebration({ totalPoints, ctaLabel, onCta }: Props) {
  useEffect(() => { void stageWin('mega'); }, []);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-4 py-10 text-center"
    >
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 opacity-30 blur-3xl" />
        <Sparkles className="h-16 w-16 text-amber-500 drop-shadow-[0_0_24px_rgba(251,191,36,0.85)]" />
      </div>
      <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground">
        Parabéns! Você está dentro.
      </h1>
      <div className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 px-6 py-5 shadow-[0_0_30px_rgba(251,146,60,0.5)] dark:border-amber-500/40 dark:from-amber-950/30 dark:to-orange-950/30">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Total conquistado</p>
        <DopamineCounter
          value={totalPoints}
          duration={1400}
          suffix=" pts"
          className="text-5xl font-extrabold tabular-nums text-amber-700 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)] dark:text-amber-300"
          celebrateOnComplete
        />
      </div>
      <Button
        size="lg"
        onClick={onCta}
        className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95"
      >
        <Rocket className="mr-2 h-5 w-5" /> {ctaLabel}
      </Button>
    </motion.div>
  );
}
