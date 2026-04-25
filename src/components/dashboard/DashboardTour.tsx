import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Wifi, BarChart3, Target, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMaturityTier } from '@/hooks/useMaturityTier';
import { useDashboardState } from '@/hooks/useDashboardState';

const TOUR_KEY = 'dashboard_tour_v1';

interface Step {
  icon: typeof Wifi;
  title: string;
  body: string;
  highlight?: string;
}

const STEPS: Step[] = [
  {
    icon: Wifi,
    title: 'Fique Online',
    body:
      'O botão Online é o coração da sua disponibilidade. Quando ativo, você ganha boost no ranking e aparece antes dos concorrentes nas buscas.',
    highlight: '[data-tour="online-status"]',
  },
  {
    icon: BarChart3,
    title: 'Acompanhe seu Impacto',
    body:
      'Aqui você vê em tempo real quantas pessoas viram seu perfil e clicaram no WhatsApp nas últimas 24 horas.',
    highlight: '[data-tour="contact-impact"]',
  },
  {
    icon: Target,
    title: 'Complete Missões',
    body:
      'Responda missões rápidas para ganhar pontos, subir de nível e desbloquear o selo "Profissional Top".',
    highlight: '[data-tour="missions"]',
  },
];

/**
 * Tour guiado de 3 passos para tier === 'novato'.
 * Respeita dismiss server-side via useDashboardState.
 * Não interfere com o widget imutável de Online (apenas o destaca visualmente).
 */
const DashboardTour = () => {
  const { tier, loading: tierLoading } = useMaturityTier();
  const { isWidgetDismissed, dismissWidget, loading: stateLoading } = useDashboardState();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const dismissed = isWidgetDismissed(TOUR_KEY);

  useEffect(() => {
    if (tierLoading || stateLoading) return;
    if (tier !== 'novato') return;
    if (dismissed) return;
    // pequena espera para o dashboard finalizar montagem
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [tier, dismissed, tierLoading, stateLoading]);

  const current = STEPS[step];

  const targetRect = useMemo(() => {
    if (!open || !current?.highlight || typeof window === 'undefined') return null;
    const el = document.querySelector(current.highlight) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }, [open, current, step]);

  const close = async (markDismissed = true) => {
    setOpen(false);
    if (markDismissed) await dismissWidget(TOUR_KEY);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else void close(true);
  };

  if (!open || typeof document === 'undefined') return null;

  const Icon = current.icon;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={() => close(true)}
      />

      {targetRect && (
        <motion.div
          key="ring"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed z-[61] rounded-2xl ring-4 ring-accent ring-offset-4 ring-offset-background"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      <motion.div
        key="card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 left-1/2 z-[62] w-[calc(100%-2rem)] max-w-md -translate-x-1/2"
      >
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-primary text-white">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  Passo {step + 1} de {STEPS.length}
                </span>
              </div>
              <h3 className="mt-1 font-display text-base font-bold text-foreground">{current.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{current.body}</p>
            </div>
            <button
              type="button"
              aria-label="Fechar tour"
              onClick={() => close(true)}
              className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-accent' : 'w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => close(true)}>
                Pular
              </Button>
              <Button size="sm" className="gap-1.5" onClick={next}>
                {step < STEPS.length - 1 ? 'Próximo' : 'Concluir'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default DashboardTour;
