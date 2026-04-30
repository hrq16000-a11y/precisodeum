/** Phase Pro Location — cidade + bairro do profissional. */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Home, LocateFixed, Info, AlertTriangle, Search } from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fieldWin } from '@/lib/betDopamine';
import { useGeoCity } from '@/hooks/useGeoCity';
import { lookupCepFromCity } from '@/lib/cepReverseLookup';
import { toast } from 'sonner';
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
  const [requestingGps, setRequestingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [cepSuggestion, setCepSuggestion] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const geo = useGeoCity();
  const preferredUF = state.state || geo.state || '';
  const autoFilledRef = useRef(false);

  // Sugestão automática (não-destrutiva): se o usuário NUNCA digitou cidade,
  // pré-preenche com o que veio do IP/GPS — visível e editável. Se já tinha
  // cidade salva (rascunho/banco), NÃO sobrescreve.
  useEffect(() => {
    if (autoFilledRef.current) return;
    if (state.city && state.city.trim().length > 0) return; // respeita o que já foi digitado
    if (geo.city && geo.state) {
      autoFilledRef.current = true;
      patch({ city: geo.city, state: geo.state });
    }
  }, [geo.city, geo.state, state.city, patch]);

  // Auto-busca de CEP quando cidade + bairro estão preenchidos.
  // Debounce 600ms para não bater no ViaCEP a cada tecla.
  useEffect(() => {
    const city = state.city.trim();
    const uf = state.state.trim().toUpperCase();
    const bairro = (state.neighborhood || '').trim();
    if (city.length < 2 || uf.length !== 2 || bairro.length < 3) {
      setCepSuggestion(null);
      return;
    }
    let cancelled = false;
    setCepLoading(true);
    const t = window.setTimeout(async () => {
      const r = await lookupCepFromCity({ city, state: uf, neighborhood: bairro });
      if (cancelled) return;
      setCepLoading(false);
      setCepSuggestion(r.ok ? r.match.cep : null);
    }, 600);
    return () => { cancelled = true; window.clearTimeout(t); setCepLoading(false); };
  }, [state.city, state.state, state.neighborhood]);

  function handleCity(next: { city: string; state: string }) {
    const { city, state: uf } = next;
    autoFilledRef.current = true; // edição manual cancela auto-preenchimento
    patch({ city, state: uf });
    if (city && uf && !awarded) {
      setAwarded(true);
      addPoints(BET_POINTS.city);
      fieldWin();
    }
  }

  function handleNeighborhood(e: React.ChangeEvent<HTMLInputElement>) {
    patch({ neighborhood: e.target.value });
  }

  function applyCepSuggestion() {
    if (!cepSuggestion) return;
    patch({ postal_code: cepSuggestion });
    toast.success('CEP preenchido automaticamente', { description: cepSuggestion });
  }

  async function handleUseGps() {
    if (requestingGps) return;
    setRequestingGps(true);
    try {
      const result = await geo.requestPreciseLocation({ force: true });
      if (result.ok && result.city && result.state) {
        autoFilledRef.current = true;
        patch({ city: result.city, state: result.state });
        setGpsAccuracy(result.accuracyMeters ?? null);
        if (!awarded) {
          setAwarded(true);
          addPoints(BET_POINTS.city);
          fieldWin();
        }
        const acc = result.accuracyMeters;
        if (acc != null && acc > 500) {
          toast.warning('GPS impreciso', {
            description: `Margem de ~${Math.round(acc)}m. Confirme bairro e cidade manualmente.`,
          });
        } else {
          toast.success('Localização detectada por GPS', {
            description: `${result.city} / ${result.state}${acc != null ? ` (±${Math.round(acc)}m)` : ''}. Confira o bairro.`,
          });
        }
      } else {
        toast.error('Não consegui acessar o GPS', {
          description: 'Permita a localização no navegador ou digite a cidade manualmente.',
        });
      }
    } finally {
      setRequestingGps(false);
    }
  }

  const cityOk = state.city.trim().length > 0 && state.state.trim().length === 2;
  const neighborhoodOk = (state.neighborhood || '').trim().length >= 2;
  const canFinish = cityOk && neighborhoodOk;
  const sourceLabel =
    geo.source === 'gps' ? 'GPS' :
    geo.source === 'ip' ? 'aproximada (IP)' :
    geo.source === 'manual' ? 'manual' :
    geo.source === 'cache' ? 'salva' : null;
  const gpsImprecise = gpsAccuracy != null && gpsAccuracy > 500;

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
          Sua cidade e bairro aparecem para clientes próximos.
        </p>
      </header>

      {/* Aviso curto de importância da localização */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="leading-snug">
          A <strong>localização correta</strong> aumenta seu match com clientes próximos. Use o GPS
          para precisão de bairro — você ainda pode editar tudo abaixo.
        </p>
      </div>

      {/* Botão GPS — sempre disponível e visível */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleUseGps}
        disabled={requestingGps}
        className="w-full justify-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950/40"
      >
        <LocateFixed className={`h-4 w-4 ${requestingGps ? 'animate-pulse' : ''}`} />
        {requestingGps ? 'Detectando…' : 'Usar minha localização (GPS)'}
      </Button>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Cidade base
          {awarded && (
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              +{BET_POINTS.city} pts
            </span>
          )}
        </span>
        <div className={`rounded-lg transition ${cityOk ? 'ring-2 ring-emerald-300/60 shadow-[0_0_14px_rgba(16,185,129,0.35)]' : ''}`}>
          <CityAutocomplete
            value={{ city: state.city, state: state.state }}
            onChange={handleCity}
            placeholder="Digite sua cidade"
            preferredUF={preferredUF}
            statusText={
              state.city
                ? sourceLabel
                  ? `Detectada ${sourceLabel}. Edite se estiver errado.`
                  : undefined
                : preferredUF
                ? `Mostrando primeiro cidades de ${preferredUF}`
                : undefined
            }
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <label htmlFor="neighborhood" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Home className="h-3.5 w-3.5" /> Bairro
        </label>
        <Input
          id="neighborhood"
          value={state.neighborhood}
          onChange={handleNeighborhood}
          placeholder="Ex: Centro, Boa Vista, Vila Nova"
          autoComplete="address-level3"
          maxLength={80}
          className={neighborhoodOk ? 'ring-2 ring-emerald-300/60' : ''}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          O bairro ajuda clientes da sua região a te encontrar mais rápido.
        </p>

        {/* Sugestão automática de CEP a partir de cidade + bairro */}
        {cepLoading && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Search className="h-3 w-3 animate-pulse" /> Procurando CEP do seu bairro…
          </p>
        )}
        {!cepLoading && cepSuggestion && state.postal_code !== cepSuggestion && (
          <button
            type="button"
            onClick={applyCepSuggestion}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <Search className="h-3 w-3" /> CEP encontrado: {cepSuggestion} — usar
          </button>
        )}
      </div>

      {/* Aviso de GPS impreciso */}
      {gpsImprecise && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="leading-snug">
            GPS impreciso (margem de ~{Math.round(gpsAccuracy!)}m). <strong>Confirme o bairro</strong> manualmente
            para garantir que clientes próximos te encontrem.
          </p>
        </div>
      )}

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
