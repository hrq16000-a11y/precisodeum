import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowRight, type LucideIcon } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';

export interface OnboardingStepperItem {
  number: string;
  title: string;
  description: string;
  action: () => void;
  actionLabel: string;
  icon: LucideIcon;
  done: boolean;
  hidden?: boolean;
}

interface ProviderOnboardingStepperProps {
  steps: OnboardingStepperItem[];
  allStepsDone: boolean;
  open: boolean;
  onToggle: () => void;
}

/**
 * "Como funciona" — stepper horizontal + bloco expansível.
 * Visual e classes preservados de DashboardPage.tsx.
 */
const ProviderOnboardingStepper = ({
  steps,
  allStepsDone,
  open,
  onToggle,
}: ProviderOnboardingStepperProps) => {
  const visibleSteps = steps.filter((s) => !s.hidden);
  const doneCount = visibleSteps.filter((s) => s.done).length;

  return (
    <GlassCard variant="glow" hoverEffect={false} delay={0.8} className="mt-6 border-accent/20 bg-accent/3">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-xl">🚀</motion.div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              Como funciona
              {allStepsDone && <span className="ml-2 text-xs font-normal text-accent">✓ Concluído</span>}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {allStepsDone ? 'Parabéns! Perfil completo.' : 'Siga os passos para receber clientes.'}
            </p>
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' as const }}
            className="overflow-hidden"
          >
            {/* Horizontal stepper */}
            <div className="mt-5 flex items-start justify-between relative px-2">
              {/* Progress line */}
              <div className="absolute top-4 left-8 right-8 h-0.5 bg-border rounded-full">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(doneCount / Math.max(visibleSteps.length, 1)) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
              </div>

              {visibleSteps.map((step, i) => {
                const StepIcon = step.icon;
                return (
                  <motion.button
                    key={step.number}
                    onClick={step.action}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex flex-col items-center gap-2 relative z-10 group flex-1"
                  >
                    <motion.div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                        step.done
                          ? 'bg-accent border-accent text-accent-foreground'
                          : 'bg-background border-border text-muted-foreground group-hover:border-accent/50'
                      }`}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {step.done ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-xs font-bold">✓</motion.span>
                      ) : (
                        <StepIcon className="h-3.5 w-3.5" />
                      )}
                    </motion.div>
                    <span className={`text-[10px] font-medium text-center leading-tight max-w-[72px] ${step.done ? 'text-accent' : 'text-muted-foreground'}`}>
                      {step.title}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Expandable details below */}
            <div className="mt-4 space-y-2">
              {visibleSteps.filter((s) => !s.done).slice(0, 1).map((step) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/5 p-3"
                >
                  <step.icon className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-foreground">{step.title}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{step.description}</p>
                    <button onClick={step.action} className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:underline">
                      {step.actionLabel} <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

export default ProviderOnboardingStepper;
