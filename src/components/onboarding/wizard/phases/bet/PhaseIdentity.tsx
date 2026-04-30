/** Phase Identity — Nome + WhatsApp com confete em rajadas. */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, User, Phone, Sparkles } from 'lucide-react';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import { Button } from '@/components/ui/button';
import { sanitizePhone } from '@/lib/whatsapp';
import { fieldWin, stageWin } from '@/lib/betDopamine';
import { BET_POINTS, type BetState } from './types';
import type { BetRewardKey } from './betRewards';

interface Props {
  state: BetState;
  patch: (p: Partial<BetState>) => void;
  next: () => void;
  awardReward: (reward: BetRewardKey, points: number) => void;
}

export default function PhaseIdentity({ state, patch, next, awardReward }: Props) {
  const phoneRef = useRef<HTMLInputElement>(null);

  // Awards on validation
  useEffect(() => {
    if (!state.rewards.name && state.full_name.trim().length >= 3) {
      awardReward('name', BET_POINTS.name);
      fieldWin();
    }
  }, [state.full_name, state.rewards.name, awardReward]);

  useEffect(() => {
    const ok = sanitizePhone(state.whatsapp).length >= 10;
    if (ok && !state.rewards.whatsapp) {
      awardReward('whatsapp', BET_POINTS.whatsapp);
      void stageWin('mega'); // explosão de confete + moedas
    }
  }, [state.whatsapp, state.rewards.whatsapp, awardReward]);

  const canAdvance =
    state.full_name.trim().length >= 3 && sanitizePhone(state.whatsapp).length >= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-3 px-4 py-3"
    >
      <header className="space-y-2 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Sparkles className="h-3 w-3" /> Cadastro express
        </div>
        <h1 className="font-display text-lg font-extrabold leading-tight text-foreground">
          Vamos começar com o básico
        </h1>
        <p className="text-xs text-muted-foreground">
          Só dois campos. Cada um vale pontos no seu ranking.
        </p>
      </header>

      <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Nome completo
            {state.rewards.name && (
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                +{BET_POINTS.name} pts
              </span>
            )}
          </span>
          <input
            type="text"
            autoComplete="name"
            value={state.full_name}
            onChange={(e) => patch({ full_name: e.target.value })}
            onBlur={() => phoneRef.current?.focus()}
            placeholder="Seu nome aqui"
            className={`w-full rounded-lg border bg-background px-3 py-2.5 text-base text-foreground outline-none transition focus:ring-2 ${
              state.rewards.name
                ? 'border-emerald-500 ring-2 ring-emerald-300/50 shadow-[0_0_14px_rgba(16,185,129,0.35)] focus:border-emerald-500 focus:ring-emerald-300/50'
                : 'border-input focus:border-amber-400 focus:ring-amber-300/40'
            }`}
          />
        </label>

        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> WhatsApp
            {state.rewards.whatsapp && (
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                +{BET_POINTS.whatsapp} pts
              </span>
            )}
          </span>
          <PhoneMaskedInput
            ref={phoneRef}
            name="whatsapp"
            value={state.whatsapp}
            onChange={(_, raw) => patch({ whatsapp: raw })}
            className={`w-full rounded-lg border bg-background px-3 py-2.5 text-base text-foreground outline-none transition focus:ring-2 ${
              state.rewards.whatsapp
                ? 'border-emerald-500 ring-2 ring-emerald-300/50 shadow-[0_0_14px_rgba(16,185,129,0.35)] focus:border-emerald-500 focus:ring-emerald-300/50'
                : 'border-input focus:border-amber-400 focus:ring-amber-300/40'
            }`}
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Usado para receber leads — DDD obrigatório.
          </span>
        </label>
      </div>

      <Button
        size="lg"
        disabled={!canAdvance}
        onClick={next}
        className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95 disabled:opacity-50"
      >
        Continuar
        <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
      </Button>
    </motion.div>
  );
}
