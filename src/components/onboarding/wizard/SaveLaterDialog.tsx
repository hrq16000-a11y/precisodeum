/**
 * SaveLaterDialog — modal de "Salvar e continuar mais tarde".
 *
 * Substitui o redirect direto pra dashboard que existia antes. Mostra:
 *  - Resumo de progresso (X de Y etapas concluídas + barra)
 *  - Lista das etapas com check/pendente
 *  - Próximo passo recomendado (se ainda houver)
 *  - 2 CTAs: "Ir pra dashboard" (rápido) ou "Ver guia de retomada" (educativo)
 *
 * Telemetria: dispara `markSaveLater(...)` com destino escolhido + % de
 * progresso, permitindo o admin comparar dashboard vs recovery_page por intent.
 *
 * Garantia de retomada: o draft remoto (`onboarding_v2_drafts`) já guarda
 * `state.phase` e payload completo — quando o usuário voltar ao /cadastro-inicial
 * o `OnboardingV2Shell` oferece restaurar o último ponto. Aqui só fazemos um
 * `flushDraftNow()` extra pra garantir que o último patch foi gravado antes
 * de sair.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, Circle, ArrowRight, LayoutDashboard, Compass } from 'lucide-react';
import { computeOnboardingProgress } from '@/lib/onboardingProgress';
import { markSaveLater } from '@/lib/conversionFunnel';
import type { OnboardingState } from './phases/v2/types';
import type { ExitIntentIntent, ExitIntentVariant } from '@/lib/exitIntentVariants';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';

export interface SaveLaterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Snapshot do estado do reducer (passa-se direto do WizardShell). */
  state: Pick<OnboardingState, 'profile' | 'service' | 'phase' | 'firstServiceId'>;
  /** Origem do gatilho — exit intent vs CTA inline. Default: 'save_later_modal'. */
  source?: 'exit_intent' | 'save_later_modal';
  intent?: ExitIntentIntent;
  variant?: ExitIntentVariant;
}

export default function SaveLaterDialog({
  open,
  onOpenChange,
  state,
  source = 'save_later_modal',
  intent = 'unknown',
  variant,
}: SaveLaterDialogProps) {
  const navigate = useNavigate();
  const summary = useMemo(() => computeOnboardingProgress(state), [state]);
  const progressPct = Math.round(summary.ratio * 100);

  // Timer de navegação rastreado — limpo ao desmontar o dialog para
  // evitar `navigate(path)` chamado depois que o componente saiu da árvore.
  const navTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (navTimer.current) window.clearTimeout(navTimer.current);
  }, []);

  const goTo = useCallback(
    (destination: 'dashboard' | 'recovery_page', path: string) => {
      markSaveLater({
        source,
        destination,
        intent,
        phase: state.phase,
        variant,
        progressPct,
      });
      onOpenChange(false);
      if (navTimer.current) window.clearTimeout(navTimer.current);
      navTimer.current = scheduleWizardTimeout(
        { phase: state.phase, action: `save_later_navigate_${destination}` },
        () => navigate(path),
        50,
      );
    },
    [navigate, onOpenChange, source, intent, state.phase, variant, progressPct],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="save-later-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">
            Seu progresso está salvo
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Quando você voltar, retomamos exatamente no ponto em que parou.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Progresso
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {summary.completed} de {summary.total} ({progressPct}%)
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>

          <ul className="space-y-1.5 text-sm" data-testid="save-later-checklist">
            {summary.items.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-2 ${
                  item.done ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {item.done ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                )}
                <span className={item.done ? 'line-through opacity-70' : ''}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          {summary.nextItem && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="font-semibold text-foreground">Próximo passo</p>
              <p className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                <ArrowRight className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                {summary.nextItem.label}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            onClick={() => goTo('recovery_page', '/cadastro/retomar')}
            data-testid="save-later-recovery"
            className="w-full gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(251,146,60,0.7)] hover:opacity-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
          >
            <Compass className="h-4 w-4" />
            Ver guia de retomada
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => goTo('dashboard', '/dashboard')}
            data-testid="save-later-dashboard"
            className="w-full gap-2 font-semibold"
          >
            <LayoutDashboard className="h-4 w-4" />
            Ir direto pra dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
