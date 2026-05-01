/** Selo "Verificado" que pisca antes de fixar. */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, BadgeCheck } from 'lucide-react';
import { badgeWin } from '@/lib/betDopamine';

interface Props {
  label: string;
  variant?: 'pf' | 'pj';
  onDone?: () => void;
}

export default function VerifiedBadgeReveal({ label, variant = 'pf', onDone }: Props) {
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    badgeWin();
    const t = window.setTimeout(() => {
      setBlink(false);
      onDone?.();
    }, 1400);
    return () => window.clearTimeout(t);
  }, [onDone]);
  const Icon = variant === 'pj' ? BadgeCheck : ShieldCheck;
  const tone =
    variant === 'pj'
      ? 'from-blue-500 via-orange-500 to-orange-500 shadow-[0_0_36px_rgba(99,102,241,0.7)]'
      : 'from-amber-400 via-orange-500 to-emerald-500 shadow-[0_0_36px_rgba(251,146,60,0.7)]';
  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
        animate={{
          scale: blink ? [1, 1.15, 0.95, 1.1, 1] : 1,
          opacity: 1,
          rotate: 0,
        }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className={`mx-auto flex w-fit items-center gap-2 rounded-2xl bg-gradient-to-br ${tone} px-5 py-3 text-white`}
      >
        <Icon className={`h-6 w-6 ${blink ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-extrabold uppercase tracking-wider">{label}</span>
      </motion.div>
    </AnimatePresence>
  );
}
