/** Phase Pro Location — cidade do profissional. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin } from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';
import { Button } from '@/components/ui/button';
import { fieldWin } from '@/lib/betDopamine';
import { BET_POINTS, type BetState } from './types';

interface Props {
  state: BetState;
  patch: (p: Partial<BetState>) => void;
  finish: () => Promise<void> | void;
  addPoints: (n: number) => void;
}

export default function PhaseProLocation({ state, patch, finish, addPoints }: Props) {
  const [awarded, setAwarded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleCity(city: string, uf: string) {
    patch({ city, state: uf });
    if (city && uf && !awarded) {
      setAwarded(true);
      addPoints(BET_POINTS.city);
      fieldWin();
    }
  }

  const canFinish = state.city.trim().length > 0 && state.state.trim().length === 2;

  async function onFinish() {
    if (!canFinish || submitting) return;
    setSubmitting(true);
    try { await finish(); } finally { setSubmitting(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-5 px-4 py-6"
    >
      <header className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-extrabold leading-tight text-foreground">
          Onde você atende?
        </h1>
        <p className="text-sm text-muted-foreground">
          Sua cidade aparece para clientes próximos.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Cidade base
          {awarded && (
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              +{BET_POINTS.city} pts
            </span>
          )}
        </span>
        <CityAutocomplete value={state.city} uf={state.state} onChange={handleCity} placeholder="Digite sua cidade" />
      </div>

      <Button
        size="lg"
        disabled={!canFinish || submitting}
        onClick={onFinish}
        className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95 disabled:opacity-50"
      >
        {submitting ? 'Salvando…' : 'Finalizar cadastro express'}
        <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
      </Button>
    </motion.div>
  );
}
