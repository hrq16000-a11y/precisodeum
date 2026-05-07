/** Phase Client City — fast-pass: cidade + bairro (opcional) e cadastro liberado.
 *  Sugestão orgânica: tenta GPS no mount; independente disso, qualquer dado
 *  vindo de IP/cache preenche cidade/UF/bairro vazios — usuário só confirma. */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Zap, Home } from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fieldWin } from '@/lib/betDopamine';
import { useGeoCity } from '@/hooks/useGeoCity';
import { sanitizeNeighborhood } from '@/lib/geoReverseGeocode';
import { BET_POINTS, type BetState } from './types';
import type { BetRewardKey } from './betRewards';

interface Props {
  state: BetState;
  patch: (p: Partial<BetState>) => void;
  finish: () => Promise<void> | void;
  awardReward: (reward: BetRewardKey, points: number) => void;
}

export default function PhaseClientCity({ state, patch, finish, awardReward }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const geo = useGeoCity();
  const preferredUF = state.state || geo.state || '';
  const userEditedRef = useRef(false);
  const gpsTriggeredRef = useRef(false);

  // Solicita GPS uma vez no mount (silencioso se negado — IP cobre).
  useEffect(() => {
    if (gpsTriggeredRef.current) return;
    gpsTriggeredRef.current = true;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    const id = window.setTimeout(() => {
      void geo.requestPreciseLocation({ force: true }).catch(() => undefined);
    }, 50);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill progressivo: enquanto não houver edição manual, preenche
  // qualquer campo vazio com o que a geo (cache/IP/GPS) já trouxer.
  useEffect(() => {
    if (userEditedRef.current) return;
    if (!geo.city && !geo.state && !geo.neighborhood) return;
    const patchObj: Partial<BetState> = {};
    if ((!state.city || !state.city.trim()) && geo.city) patchObj.city = geo.city;
    if ((!state.state || state.state.trim().length !== 2) && geo.state) patchObj.state = geo.state;
    if (!(state.neighborhood && state.neighborhood.trim())) {
      const clean = sanitizeNeighborhood(geo.neighborhood, geo.city || state.city);
      if (clean) patchObj.neighborhood = clean;
    }
    if (Object.keys(patchObj).length > 0) patch(patchObj);
  }, [geo.city, geo.state, geo.neighborhood, state.city, state.state, state.neighborhood, patch]);

  function handleCity(next: { city: string; state: string }) {
    const { city, state: uf } = next;
    userEditedRef.current = true;
    patch({ city, state: uf });
    if (city && uf && !state.rewards.city) {
      awardReward('city', BET_POINTS.city);
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
      className="mx-auto w-full max-w-md space-y-3 px-4 py-3"
    >
      <header className="space-y-2 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Zap className="h-3 w-3" /> Fast-pass do cliente
        </div>
        <h1 className="font-display text-lg font-extrabold leading-tight text-foreground">
          Onde você está?
        </h1>
        <p className="text-xs text-muted-foreground">
          Mostramos profissionais da sua cidade. É só isso — você já entra no app.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Sua cidade
          {state.rewards.city && (
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              +{BET_POINTS.city} pts
            </span>
          )}
        </span>
        <div className={`rounded-lg transition ${state.rewards.city ? 'ring-2 ring-emerald-300/60 shadow-[0_0_14px_rgba(16,185,129,0.35)]' : ''}`}>
          <CityAutocomplete
            value={{ city: state.city, state: state.state }}
            onChange={handleCity}
            placeholder="Digite sua cidade"
            preferredUF={preferredUF}
            statusText={preferredUF ? `Mostrando primeiro cidades de ${preferredUF}` : undefined}
          />
        </div>
      </div>

      {/* Bairro opcional — refina a busca por proximidade. */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <label htmlFor="client-neighborhood" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Home className="h-3.5 w-3.5" /> Bairro
          <span className="ml-1 text-[10px] font-normal normal-case text-muted-foreground/70">(opcional, melhora seu match)</span>
        </label>
        <Input
          id="client-neighborhood"
          value={state.neighborhood}
          onChange={(e) => { userEditedRef.current = true; patch({ neighborhood: e.target.value }); }}
          placeholder="Ex: Centro, Vila Nova"
          autoComplete="address-level3"
          maxLength={80}
        />
      </div>

      <Button
        size="lg"
        disabled={!canFinish || submitting}
        onClick={onFinish}
        className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600 text-base font-bold text-white shadow-[0_0_24px_rgba(99,102,241,0.55)] hover:opacity-95 disabled:opacity-50"
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
