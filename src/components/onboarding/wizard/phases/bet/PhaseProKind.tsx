/** Phase Pro Kind — PF (Autônomo) ou PJ (Empresa/MEI). */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Building2, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { fieldWin } from '@/lib/betDopamine';
import { BET_POINTS, type BetProKind, type BetState } from './types';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';
import type { BetRewardKey } from './betRewards';
import { PrefilledBadge, prefilledSelectCard } from '@/components/onboarding/wizard/PrefilledBadge';
import { cn } from '@/lib/utils';

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
    const isPf = kind === 'pf';
    if (!state.rewards.pro_kind) {
      awardReward('pro_kind', BET_POINTS.pro_kind);
    }
    fieldWin();
    toast.success(
      isPf ? 'Perfil Autônomo selecionado' : 'Perfil Empresa selecionado',
      {
        description: isPf
          ? 'Você vai concorrer ao Selo de Confiança.'
          : 'Você vai concorrer ao Selo Empresa Verificada.',
        icon: isPf ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />,
        duration: 1800,
      },
    );
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = scheduleWizardTimeout(
      { phase: 'phase1_action', action: 'phase_pro_kind_next' },
      next,
      450,
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-5 px-4 py-4"
    >
      <header className="space-y-2 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Sparkles className="h-3 w-3" /> Escolha seu perfil profissional
        </div>
        <h1 className="font-display text-2xl font-extrabold leading-tight text-foreground">
          Como você atua?
        </h1>
        <p className="text-xs text-muted-foreground">Escolha o que melhor representa o seu trabalho.</p>
      </header>

      <div className="grid gap-5">
        {/* PF — Autônomo: glow âmbar pulsante + ícone flutuando */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -3 }}
          animate={{
            boxShadow: [
              '0 0 0 rgba(251,146,60,0)',
              '0 0 32px rgba(251,146,60,0.45)',
              '0 0 0 rgba(251,146,60,0)',
            ],
          }}
          transition={{ boxShadow: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } }}
          onClick={() => pick('pf')}
          aria-pressed={state.pro_kind === 'pf'}
          className={cn(
            'group relative overflow-hidden rounded-3xl border-2 border-amber-400/80 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 p-7 text-left shadow-card transition dark:border-amber-500/50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40',
            state.pro_kind === 'pf' && prefilledSelectCard,
          )}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-x-10 -top-10 h-24 rotate-12 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 transition-all duration-700 group-hover:translate-x-[160%] group-hover:opacity-100 dark:via-white/10"
          />
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-[0_10px_30px_-8px_rgba(251,146,60,0.7)]"
            >
              <User className="h-10 w-10" strokeWidth={1.75} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold leading-tight text-foreground">
                  Sou Autônomo / Pessoa Física
                </h2>
                {state.pro_kind === 'pf' && <PrefilledBadge label="Selecionado" />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Ganhe o <strong className="text-amber-700 dark:text-amber-300">Selo de Confiança</strong>{' '}
                e <strong>+{BET_POINTS.cpf_badge} pts</strong>
              </p>
            </div>
          </div>
        </motion.button>

        {/* PJ — Empresa: scale pulse no ícone + tilt no hover */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ rotate: -0.6, y: -3 }}
          onClick={() => pick('pj')}
          aria-pressed={state.pro_kind === 'pj'}
          className={cn(
            'group relative overflow-hidden rounded-3xl border-2 border-orange-500/70 bg-gradient-to-br from-orange-50 via-amber-50 to-emerald-50 p-7 text-left shadow-card transition hover:shadow-[0_18px_40px_-12px_rgba(234,88,12,0.45)] dark:border-orange-500/50 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-emerald-950/30',
            state.pro_kind === 'pj' && prefilledSelectCard,
          )}
        >
          <motion.span
            aria-hidden
            animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute -left-6 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-orange-300/60 blur-2xl dark:bg-orange-500/30"
          />
          <div className="relative flex items-center gap-4">
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-emerald-500 text-white shadow-[0_10px_30px_-8px_rgba(234,88,12,0.7)]"
            >
              <Building2 className="h-10 w-10" strokeWidth={1.75} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold leading-tight text-foreground">
                  Sou Empresa / MEI / PJ
                </h2>
                {state.pro_kind === 'pj' && <PrefilledBadge label="Selecionado" />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Ganhe o <strong className="text-orange-700 dark:text-orange-300">Selo Empresa Verificada</strong>{' '}
                e <strong>+{BET_POINTS.cnpj_badge} pts</strong>
              </p>
            </div>
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
