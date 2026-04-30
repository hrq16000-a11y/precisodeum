/** Phase Client City — fast-pass: cidade + bairro (opcional) e cadastro liberado. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Zap, Home } from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fieldWin } from '@/lib/betDopamine';
import { useGeoCity } from '@/hooks/useGeoCity';
import { BET_POINTS, type BetState } from './types';

interface Props {
  state: BetState;
  patch: (p: Partial<BetState>) => void;
  finish: () => Promise<void> | void;
  addPoints: (n: number) => void;
}

export default function PhaseClientCity({ state, patch, finish, addPoints }: Props) {
  const [awarded, setAwarded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const geo = useGeoCity();
  const preferredUF = state.state || geo.state || '';

  function handleCity(next: { city: string; state: string }) {
    const { city, state: uf } = next;
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
    try {
      await finish();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-5 px-4 py-6"
    >
      <header className="space-y-2 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <Zap className="h-3 w-3" /> Fast-pass do cliente
        </div>
        <h1 className="font-display text-2xl font-extrabold leading-tight text-foreground">
          Onde você está?
        </h1>
        <p className="text-sm text-muted-foreground">
          Mostramos profissionais da sua cidade. É só isso — você já entra no app.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Sua cidade
          {awarded && (
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              +{BET_POINTS.city} pts
            </span>
          )}
        </span>
        <div className={`rounded-lg transition ${awarded ? 'ring-2 ring-emerald-300/60 shadow-[0_0_14px_rgba(16,185,129,0.35)]' : ''}`}>
          <CityAutocomplete
            value={{ city: state.city, state: state.state }}
            onChange={handleCity}
            placeholder="Digite sua cidade"
            preferredUF={preferredUF}
            statusText={preferredUF ? `Mostrando primeiro cidades de ${preferredUF}` : undefined}
          />
        </div>
      </div>

      <Button
        size="lg"
        disabled={!canFinish || submitting}
        onClick={onFinish}
        className="group h-12 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 text-base font-bold text-white shadow-[0_0_24px_rgba(99,102,241,0.55)] hover:opacity-95 disabled:opacity-50"
      >
        {submitting ? 'Liberando acesso…' : 'Entrar no app agora'}
        <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Sem foto, sem mais formulários. Você cai direto onde estava.
      </p>
    </motion.div>
  );
}
