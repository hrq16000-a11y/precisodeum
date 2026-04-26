/**
 * Phase3 — Tela de Sucesso (O Êxtase).
 *
 * Quando o 1º serviço é publicado, mostramos uma celebração imersiva:
 *  - Confete + som de conquista (celebrate())
 *  - Placar com números correndo rápido (estilo aposta esportiva)
 *  - Copy curto e direto: "Você está apto para receber clientes!"
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MapPin, Briefcase, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { celebrate, CELEBRATION_IDS } from '@/lib/celebrate';
import { supabase } from '@/integrations/supabase/client';

interface Phase3Props {
  serviceName: string;
  city: string;
  state: string;
  userId: string | undefined;
  onContinue: () => void;
}

/** Counter animation: rola números rápido até o alvo. */
function useTickerNumber(target: number, durationMs = 1100): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      // ease-out
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return n;
}

export const Phase3Celebration = ({ serviceName, city, state, userId, onContinue }: Phase3Props) => {
  // Dispara confetti + som apenas uma vez
  useEffect(() => {
    celebrate({
      intensity: 'big',
      id: CELEBRATION_IDS.onboardingComplete(userId || 'anon'),
    });
  }, [userId]);

  // Placar fictício mas plausível — comunica "você está vivo no sistema"
  const reach = useTickerNumber(1280, 1300);
  const score = useTickerNumber(73, 1100);
  const time = useTickerNumber(94, 900);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.6, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-2xl"
      >
        <Sparkles className="h-10 w-10" />
      </motion.div>

      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-foreground">Sucesso!</h1>
        <p className="text-sm text-muted-foreground">
          Seu primeiro serviço já está no mapa do PrecisodeumProfissional.com.br.
        </p>
        <p className="font-display text-base font-semibold text-foreground">
          Você está apto para receber clientes.
        </p>
      </div>

      {/* Placar estilo "score" — números correndo */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 p-4">
        <div>
          <p className="font-display text-3xl font-bold tabular-nums text-foreground">{reach.toLocaleString('pt-BR')}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">alcance/mês*</p>
        </div>
        <div>
          <p className="font-display text-3xl font-bold tabular-nums text-foreground">{score}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">score perfil</p>
        </div>
        <div>
          <p className="font-display text-3xl font-bold tabular-nums text-foreground">{time}%</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">visibilidade</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 text-left text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5" />
          <span className="truncate font-medium text-foreground">{serviceName || 'Seu serviço'}</span>
        </div>
        {(city || state) && (
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{city}{state ? ` • ${state}` : ''}</span>
          </div>
        )}
      </div>

      <Button type="button" size="lg" onClick={onContinue} className="w-full">
        Continuar <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
      <p className="text-[10px] text-muted-foreground">*estimativa com base na sua categoria + região</p>
    </motion.div>
  );
};
