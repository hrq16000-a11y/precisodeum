/** Phase Who — Sou Profissional / Sou Cliente.
 *
 * RH e Patrocinador foram ocultados desta tela (mai/2026): a triagem padrão
 * agora foca apenas nos dois fluxos principais. Esses tipos de conta seguem
 * existindo no domínio (BetIntent), mas o cadastro deles é feito por outras
 * portas (admin / convites / fluxos dedicados).
 */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Search, Sparkles } from 'lucide-react';
import { fieldWin } from '@/lib/betDopamine';
import { BET_POINTS, type BetIntent, type BetState } from './types';
import {
  setOnboardingIntent,
  type OnboardingIntent,
} from '@/components/onboarding/wizard/phases/v2/telemetry';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';
import type { BetRewardKey } from './betRewards';
import { PrefilledBadge, prefilledSelectCard } from '@/components/onboarding/wizard/PrefilledBadge';
import { cn } from '@/lib/utils';

interface Props {
  state: BetState;
  patch: (p: Partial<BetState>) => void;
  goto: (intent: BetIntent) => void;
  awardReward: (reward: BetRewardKey, points: number) => void;
}

/** Mapeia BetIntent → OnboardingIntent (telemetria normalizada). */
function toTelemetryIntent(i: BetIntent): OnboardingIntent | null {
  if (i === 'professional' || i === 'client' || i === 'rh') return i;
  return null;
}

export default function PhaseWho({ state, patch, goto, awardReward }: Props) {
  // Timer de transição animada — rastreado para limpar no unmount,
  // evitando que `goto` (navegação) dispare em componente já desmontado.
  const transitionTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
  }, []);

  function pick(intent: BetIntent) {
    patch({ intent });
    setOnboardingIntent(toTelemetryIntent(intent));
    if (!state.rewards.intent) {
      awardReward('intent', BET_POINTS.intent);
    }
    fieldWin();
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = scheduleWizardTimeout(
      { phase: 'phase1_action', action: 'phase_who_goto' },
      () => goto(intent),
      280,
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-5 px-4 py-3"
    >
      <header className="space-y-2 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Sparkles className="h-3 w-3" /> +{BET_POINTS.intent} pts ao escolher
        </div>
        <h1 className="font-display text-2xl font-extrabold leading-tight text-foreground">
          Quem é você?
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha como vai usar a plataforma.
        </p>
      </header>

      <div className="grid gap-5">
        {/* CARD 1 — PROFISSIONAL
            Efeito: brilho âmbar pulsante contínuo + ícone com leve flutuação
            (float) e rotação no hover. Borda dourada espessa para hierarquia. */}
        <motion.button
          type="button"
          onClick={() => pick('professional')}
          aria-pressed={state.intent === 'professional'}
          initial={{ opacity: 0, y: 18 }}
          animate={{
            opacity: 1,
            y: 0,
            boxShadow: [
              '0 0 0 rgba(251,146,60,0)',
              '0 0 36px rgba(251,146,60,0.45)',
              '0 0 0 rgba(251,146,60,0)',
            ],
          }}
          transition={{
            opacity: { duration: 0.4, delay: 0.05 },
            y: { duration: 0.4, delay: 0.05 },
            boxShadow: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
          }}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'group relative w-full overflow-hidden rounded-3xl border-2 border-amber-400/80 bg-gradient-to-br from-amber-50 via-orange-50 to-emerald-50 p-7 text-left shadow-xl transition-all',
            'dark:border-amber-500/60 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-emerald-950/40',
            state.intent === 'professional' && prefilledSelectCard,
          )}
        >
          {/* sweep diagonal âmbar→laranja no hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-300/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />
          <div className="relative flex items-center gap-5">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ rotate: -8, scale: 1.1 }}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 text-white shadow-[0_10px_30px_-8px_rgba(251,146,60,0.7)]"
            >
              <Briefcase className="h-10 w-10" strokeWidth={2.2} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                  Sou Profissional
                </h2>
                {state.intent === 'professional' && <PrefilledBadge label="Selecionado" />}
              </div>
              <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
                Quero clientes
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ofereço serviços e quero ser encontrado
              </p>
            </div>
          </div>
        </motion.button>

        {/* CARD 2 — CLIENTE
            Efeito diferente: ícone com pulso de busca (scale ritmado) e card
            que faz "tilt" suave no hover. Gradiente verde-âmbar invertido
            para diferenciar do card profissional. */}
        <motion.button
          type="button"
          onClick={() => pick('client')}
          aria-pressed={state.intent === 'client'}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          whileHover={{ scale: 1.03, rotate: -0.6 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'group relative w-full overflow-hidden rounded-3xl border-2 border-emerald-300/80 bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50 p-7 text-left shadow-xl transition-all hover:shadow-[0_0_40px_rgba(16,185,129,0.45)]',
            'dark:border-emerald-500/50 dark:from-emerald-950/40 dark:via-amber-950/30 dark:to-orange-950/40',
            state.intent === 'client' && prefilledSelectCard,
          )}
        >
          {/* anel concêntrico animado atrás do ícone */}
          <span
            aria-hidden
            className="pointer-events-none absolute -left-6 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-emerald-300/20 blur-2xl transition-all duration-700 group-hover:scale-125 group-hover:bg-emerald-300/40"
          />
          <div className="relative flex items-center gap-5">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.18, rotate: 8 }}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-amber-500 text-white shadow-[0_10px_30px_-8px_rgba(16,185,129,0.7)]"
            >
              <Search className="h-10 w-10" strokeWidth={2.2} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                  Sou Cliente
                </h2>
                {state.intent === 'client' && <PrefilledBadge label="Selecionado" />}
              </div>
              <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Procuro profissionais
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Quero contratar alguém para um serviço
              </p>
            </div>
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
