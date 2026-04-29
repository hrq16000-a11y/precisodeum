/** Phase Who — Sou Profissional / Sou Cliente. */
import { motion } from 'framer-motion';
import { Briefcase, Search, Sparkles, Building2, Megaphone } from 'lucide-react';
import { fieldWin } from '@/lib/betDopamine';
import { BET_POINTS, type BetIntent, type BetState } from './types';
import {
  setOnboardingIntent,
  type OnboardingIntent,
} from '@/components/onboarding/wizard/phases/v2/telemetry';

interface Props {
  state: BetState;
  patch: (p: Partial<BetState>) => void;
  goto: (intent: BetIntent) => void;
  addPoints: (n: number) => void;
}

/** Mapeia BetIntent → OnboardingIntent (telemetria normalizada). */
function toTelemetryIntent(i: BetIntent): OnboardingIntent | null {
  if (i === 'professional' || i === 'client' || i === 'rh') return i;
  return null; // sponsor não entra no funil de cadastro padrão
}

export default function PhaseWho({ patch, goto, addPoints }: Props) {
  function pick(intent: BetIntent) {
    patch({ intent, rewards: { ...((arguments[0] as any)?.rewards ?? {}), intent: true } } as any);
    // Persiste intent real para auto-injeção em todos os eventos subsequentes
    // (milestone, skip, next, error, complete) — fonte única em sessionStorage.
    setOnboardingIntent(toTelemetryIntent(intent));
    addPoints(BET_POINTS.intent);
    fieldWin();
    window.setTimeout(() => goto(intent), 250);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-5 px-4 py-6"
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

      <div className="grid gap-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pick('professional')}
          className="group relative overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-5 text-left shadow-card transition hover:shadow-[0_0_30px_rgba(251,146,60,0.55)] dark:border-amber-500/40 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-rose-950/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
              <Briefcase className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-foreground">
                Sou Profissional — Quero Clientes
              </h2>
              <p className="text-xs text-muted-foreground">
                Ofereço serviços e quero ser encontrado
              </p>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pick('client')}
          className="group relative overflow-hidden rounded-2xl border border-blue-300 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-5 text-left shadow-card transition hover:shadow-[0_0_30px_rgba(99,102,241,0.55)] dark:border-blue-500/40 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <Search className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-foreground">
                Sou Cliente — Procuro Profissionais
              </h2>
              <p className="text-xs text-muted-foreground">
                Quero contratar alguém para um serviço
              </p>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pick('rh')}
          className="group relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/10 p-5 text-left shadow-card transition hover:shadow-[0_0_30px_hsl(var(--primary)/0.35)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-foreground">
                Sou Agência de RH
              </h2>
              <p className="text-xs text-muted-foreground">
                Quero publicar vagas e gerenciar minha agência
              </p>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => pick('sponsor')}
          className="group relative overflow-hidden rounded-2xl border border-secondary/40 bg-gradient-to-br from-secondary/10 via-muted/40 to-background p-5 text-left shadow-card transition hover:shadow-[0_0_30px_hsl(var(--secondary)/0.25)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-lg">
              <Megaphone className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-foreground">
                Sou Patrocinador
              </h2>
              <p className="text-xs text-muted-foreground">
                Quero anunciar minha marca na plataforma
              </p>
            </div>
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
