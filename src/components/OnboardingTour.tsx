import { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const PROVIDER_STEPS: TourStep[] = [
  { target: '[data-tour="profile-strength"]', title: 'Forca do Perfil', description: 'Acompanhe aqui o quanto seu perfil esta completo. Perfis completos aparecem mais nas buscas.' },
  { target: '[data-tour="services"]', title: 'Seus Servicos', description: 'Cadastre os servicos que voce oferece para ser encontrado por clientes.' },
  { target: '[data-tour="leads"]', title: 'Seus Leads', description: 'Aqui voce visualiza todas as solicitacoes de orcamento que recebeu.' },
  { target: '[data-tour="share"]', title: 'Compartilhe seu Perfil', description: 'Compartilhe seu perfil nas redes sociais para atrair mais clientes.' },
];

const TOUR_KEY = 'onboarding_tour_completed';

async function persistOnboardingCompleted() {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (uid) {
      await supabase.from('profiles').update({ onboarding_completed: true } as any).eq('id', uid);
    }
  } catch (_) { /* silent */ }
}

export function useOnboardingTour(profileType: string, onboardingCompletedFromDb?: boolean) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Banco é a fonte de verdade — se já marcado como concluído, nem dispara.
    if (onboardingCompletedFromDb) {
      localStorage.setItem(TOUR_KEY, 'true');
      return;
    }
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed && profileType === 'provider') {
      const timer = setTimeout(() => {
        const hasAnyTarget = PROVIDER_STEPS.some(s => document.querySelector(s.target));
        if (hasAnyTarget) setActive(true);
        else localStorage.setItem(TOUR_KEY, 'skipped');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [profileType, onboardingCompletedFromDb]);

  const dismiss = useCallback(() => {
    setActive(false);
    localStorage.setItem(TOUR_KEY, 'true');
    persistOnboardingCompleted();
  }, []);

  const next = useCallback(() => {
    if (step < PROVIDER_STEPS.length - 1) setStep(s => s + 1);
    else dismiss();
  }, [step, dismiss]);

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  return { active, step, steps: PROVIDER_STEPS, next, prev, dismiss };
}

interface OnboardingTourProps {
  active: boolean;
  step: number;
  steps: TourStep[];
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
}

export default function OnboardingTour({ active, step, steps, onNext, onPrev, onDismiss }: OnboardingTourProps) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number; centered?: boolean } | null>(null);
  const currentStep = steps[step];

  useEffect(() => {
    if (!active || !currentStep) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // ~3s with 150ms interval

    const computePos = (el: Element) => {
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 12,
        left: Math.max(16, rect.left),
        width: Math.min(320, window.innerWidth - 32),
      });
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* ignore */ }
    };

    const tryFind = () => {
      if (cancelled) return;
      const el = document.querySelector(currentStep.target);
      if (el) {
        computePos(el);
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        // Fallback: center the card so the tour never disappears silently.
        const width = Math.min(360, window.innerWidth - 32);
        setPos({
          top: window.scrollY + Math.max(120, window.innerHeight / 2 - 120),
          left: Math.max(16, (window.innerWidth - width) / 2),
          width,
          centered: true,
        });
        return;
      }
      setTimeout(tryFind, 150);
    };

    setPos(null);
    tryFind();
    return () => { cancelled = true; };
  }, [active, step, currentStep]);

  // Keep position synced with scroll/resize
  useEffect(() => {
    if (!active || !currentStep) return;
    const sync = () => {
      const el = document.querySelector(currentStep.target);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos(prev => ({
        top: rect.bottom + window.scrollY + 12,
        left: Math.max(16, rect.left),
        width: Math.min(320, window.innerWidth - 32),
        centered: prev?.centered && !el ? true : false,
      }));
    };
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, { passive: true });
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync);
    };
  }, [active, currentStep]);

  // Esc closes the tour
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onDismiss]);

  if (!active || !pos || !currentStep) return null;

  return (
    <>
      {/* Overlay — clicking the overlay should NOT dismiss; only the X / Concluir do. */}
      <div className="fixed inset-0 bg-black/40 z-[9998]" />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed z-[9999] bg-card border border-border rounded-xl shadow-xl p-4"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <button onClick={onDismiss} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground" aria-label="Fechar tour">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">{step + 1}/{steps.length}</span>
          </div>

          <h4 className="font-semibold text-sm mb-1">{currentStep.title}</h4>
          <p className="text-xs text-muted-foreground mb-3">{currentStep.description}</p>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onPrev} disabled={step === 0} className="h-7 text-xs">
              <ArrowLeft className="h-3 w-3 mr-1" /> Voltar
            </Button>
            <Button size="sm" onClick={onNext} className="h-7 text-xs">
              {step === steps.length - 1 ? 'Concluir' : 'Proximo'} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
