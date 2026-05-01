/** Phase Pro Kind — PF (Autônomo) ou PJ (Empresa/MEI). */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Building2, Sparkles } from 'lucide-react';
import { fieldWin } from '@/lib/betDopamine';
import { BET_POINTS, type BetProKind, type BetState } from './types';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';
import type { BetRewardKey } from './betRewards';

interface Props {
  state: BetState;
  patch: (p: Partial<BetState>) => void;
  next: () => void;
  awardReward: (reward: BetRewardKey, points: number) => void;
}

export default function PhaseProKind({ state, patch, next, awardReward }: Props) {
  // Cleanup do timer de transição animada — evita callback após unmount.
  const transitionTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
  }, []);

  function pick(kind: BetProKind) {
    patch({ pro_kind: kind });
    if (!state.rewards.pro_kind) {
      awardReward('pro_kind', BET_POINTS.pro_kind);
    }
    fieldWin();
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = scheduleWizardTimeout(
      { phase: 'phase1_action', action: 'phase_pro_kind_next' },
      next,
      250,
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-3 px-4 py-3"
    >
      <header className="space-y-2 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Sparkles className="h-3 w-3" /> Escolha seu perfil profissional
        </div>
        <h1 className="font-display text-lg font-extrabold leading-tight text-foreground">
          Como você atua?
        </h1>
      </header>

      <div className="grid gap-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pick('pf')}
          className="group rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-left shadow-card transition hover:shadow-[0_0_24px_rgba(251,146,60,0.5)] dark:border-amber-500/40 dark:from-amber-950/30 dark:to-orange-950/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-foreground">Sou Autônomo / Pessoa Física</h2>
              <p className="text-xs text-muted-foreground">
                Ganhe o <strong className="text-amber-700 dark:text-amber-300">Selo de Confiança</strong> e <strong>+{BET_POINTS.cpf_badge} pts</strong>
              </p>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pick('pj')}
          className="group rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-orange-50 p-5 text-left shadow-card transition hover:shadow-[0_0_24px_rgba(99,102,241,0.5)] dark:border-amber-500/40 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-orange-950/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-foreground">Sou Empresa / MEI / PJ</h2>
              <p className="text-xs text-muted-foreground">
                Ganhe o <strong className="text-amber-700 dark:text-amber-300">Selo Empresa Verificada</strong> e <strong>+{BET_POINTS.cnpj_badge} pts</strong>
              </p>
            </div>
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
