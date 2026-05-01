/** Phase Pro Location — cidade-base + bairro do profissional.
 *
 *  Regras:
 *  - Cidade-base = MUNICÍPIO oficial (nunca "Região Metropolitana" — isso é área).
 *  - Bairro nunca pode ser igual à cidade nem label regional (sanitizeNeighborhood).
 *  - Lat/Lng/IBGE são persistidos no draft (sobrevivem a Voltar/Avançar e troca de aba).
 *  - Prévia explícita antes do GPS mostrando o que será preenchido.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Home, LocateFixed, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import CityAutocomplete from '@/components/CityAutocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fieldWin } from '@/lib/betDopamine';
import { useGeoCity } from '@/hooks/useGeoCity';
import { toast } from 'sonner';
import CepSuggestionCard from './CepSuggestionCard';
import { startGpsTimer, trackGpsAttempt, mapGeolocationError } from '@/lib/locationTelemetry';
import { useAuth } from '@/hooks/useAuth';
import { sanitizeNeighborhood } from '@/lib/geoReverseGeocode';
import { validateBaseCityVsServiceArea, hasBlockingBaseCityIssue } from '@/lib/locationConsistency';
import { recordMyGeoEvent } from '@/lib/providerGeoAudit';
import { lookupCep, normalizeCep } from '@/lib/cepLookup';
// isUF removido (input UF da prévia foi mesclado com o CityAutocomplete).
import { trackOnboardingEvent } from '../v2/telemetry';
import { BET_POINTS, type BetState } from './types';
import type { BetRewardKey } from './betRewards';

interface Props {
  state: BetState;
  patch: (p: Partial<BetState>) => void;
  finish: () => Promise<void> | void;
  awardReward: (reward: BetRewardKey, points: number) => void;
}

export default function PhaseProLocation({ state, patch, finish, awardReward }: Props) {
  const awarded = state.rewards.city;
  const [submitting, setSubmitting] = useState(false);
  const [requestingGps, setRequestingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const geo = useGeoCity();
  const preferredUF = state.state || geo.state || '';
  const autoFilledRef = useRef(false);
  const cepLookupRef = useRef<string>('');
  // [UX-merge] Prévia removida — cidade-base + bairro são o único ponto de
  // edição. A confirmação é implícita: assim que houver cidade/UF válidos +
  // fonte conhecida (gps/cep/manual/ip), o usuário pode finalizar.

  // Auto-sugestão (não-destrutiva): pré-preenche cidade/UF se vazios.
  // Bairro só auto-preenche se vier sanitizado (≠ cidade, não-regional).
  useEffect(() => {
    if (autoFilledRef.current) return;
    if (state.city && state.city.trim().length > 0) return;
    if (geo.city && geo.state) {
      autoFilledRef.current = true;
      const cleanNeighborhood = sanitizeNeighborhood(geo.neighborhood, geo.city);
      patch({
        city: geo.city,
        state: geo.state,
        location_source: state.location_source ?? (geo.source === 'gps' ? 'gps' : 'ip'),
        ...(geo.latitude != null && geo.longitude != null
          ? { latitude: geo.latitude, longitude: geo.longitude }
          : {}),
        ...(!(state.neighborhood && state.neighborhood.trim()) && cleanNeighborhood
          ? { neighborhood: cleanNeighborhood }
          : {}),
      });
    }
  }, [geo.city, geo.state, geo.neighborhood, geo.latitude, geo.longitude, geo.source, state.city, state.neighborhood, state.location_source, patch]);

  function awardCityOnce() {
    if (state.rewards.city) return;
    awardReward('city', BET_POINTS.city);
    fieldWin();
  }

  function handleCity(next: { city: string; state: string }) {
    const { city, state: uf } = next;
    autoFilledRef.current = true;
    // Edição manual invalida lat/lng/ibge antigos da cidade anterior.
    const cityChanged = city !== state.city || uf !== state.state;
    patch({
      city,
      state: uf,
      ...(cityChanged ? { latitude: null, longitude: null, ibge_code: null, location_source: 'manual' } : {}),
    });
    if (city && uf) awardCityOnce();
  }

  function handleNeighborhood(e: React.ChangeEvent<HTMLInputElement>) {
    patch({ neighborhood: e.target.value });
  }

  async function applyCepSuggestion(cep: string) {
    patch({ postal_code: cep });
    toast.success('CEP preenchido automaticamente', { description: cep });
    await lookupAndApplyCep(cep);
  }

  async function lookupAndApplyCep(rawCep: string) {
    const norm = normalizeCep(rawCep);
    if (!norm || cepLookupRef.current === norm) return;
    cepLookupRef.current = norm;
    const r = await lookupCep(norm);
    if (!r.ok) return;
    let cleanNeighborhood = sanitizeNeighborhood(r.neighborhood, r.city);

    // Fallback: se o CEP não trouxe bairro confiável (ex: zona rural ou bairro
    // inconsistente com a cidade), tenta Nominatim usando a cidade/UF como pivô.
    if (!cleanNeighborhood && r.city && r.state) {
      try {
        const q = encodeURIComponent(`${r.city}, ${r.state}, Brasil`);
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${q}`,
          { headers: { Accept: 'application/json' } },
        );
        if (resp.ok) {
          const list = await resp.json();
          const addr = list?.[0]?.address || {};
          const candidate =
            addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || null;
          cleanNeighborhood = sanitizeNeighborhood(candidate, r.city) || null;
        }
      } catch { /* silencioso — bairro continua opcional */ }
    }

    patch({
      city: r.city,
      state: r.state,
      ...(cleanNeighborhood && !state.neighborhood?.trim() ? { neighborhood: cleanNeighborhood } : {}),
      // BrasilAPI v2 traz ibge em data.city_ibge; lookupCep não expõe. Mantemos null aqui — o
      // backend fará a normalização final via sync_cidade trigger. Coordenadas só por GPS.
      location_source: 'cep',
    });
    if (r.city && r.state) awardCityOnce();
  }

  const { user } = useAuth();

  async function handleUseGps() {
    if (requestingGps) return;
    setRequestingGps(true);
    const timer = startGpsTimer();
    try {
      const result = await geo.requestPreciseLocation({ force: true });
      const latency_ms = timer.stop();
      if (result.ok && result.city && result.state) {
        autoFilledRef.current = true;
        const cleanNeighborhood = sanitizeNeighborhood(result.neighborhood, result.city);
        const currentNeighborhood = (state.neighborhood || '').trim();
        const patchObj: Partial<BetState> = {
          city: result.city,
          state: result.state,
          latitude: geo.latitude,
          longitude: geo.longitude,
          location_source: 'gps',
        };
        if (cleanNeighborhood && !currentNeighborhood) {
          patchObj.neighborhood = cleanNeighborhood;
        }
        patch(patchObj);
        setGpsAccuracy(result.accuracyMeters ?? null);
        awardCityOnce();
        const acc = result.accuracyMeters;
        trackGpsAttempt({
          phase: 'pro_location',
          userId: user?.id || null,
          ok: true,
          latency_ms,
          accuracy_m: acc ?? null,
        });
        // Histórico de origem da localização (audit trail por prestador).
        void recordMyGeoEvent({
          event_type: 'gps_attempt',
          source: 'gps',
          city: result.city,
          state: result.state,
          neighborhood: cleanNeighborhood || null,
          latitude: geo.latitude ?? null,
          longitude: geo.longitude ?? null,
          accuracy_m: acc ?? null,
          latency_ms,
          status: 'ok',
        });
        // [UX-merge] Não há mais bloco de prévia; GPS já atualiza state direto.
        if (acc != null && acc > 500) {
          toast.warning('GPS impreciso', {
            description: `Margem de ~${Math.round(acc)}m. Confirme bairro e cidade manualmente.`,
          });
        } else if (cleanNeighborhood) {
          toast.success('Localização detectada por GPS', {
            description: `${result.city} / ${result.state} — ${cleanNeighborhood}${acc != null ? ` (±${Math.round(acc)}m)` : ''}.`,
          });
        } else {
          toast.success('Cidade detectada por GPS', {
            description: `${result.city} / ${result.state}. Informe o bairro manualmente — não conseguimos detectá-lo com precisão.`,
          });
        }
      } else {
        trackGpsAttempt({
          phase: 'pro_location',
          userId: user?.id || null,
          ok: false,
          latency_ms,
          error_code: 'permission_denied',
        });
        toast.error('Não consegui acessar o GPS', {
          description: 'Permita a localização no navegador ou digite a cidade manualmente.',
        });
      }
    } catch (err) {
      const latency_ms = timer.stop();
      trackGpsAttempt({
        phase: 'pro_location',
        userId: user?.id || null,
        ok: false,
        latency_ms,
        error_code: mapGeolocationError(err),
      });
      toast.error('Falha inesperada no GPS');
    } finally {
      setRequestingGps(false);
    }
  }

  const cityOk = state.city.trim().length > 0 && state.state.trim().length === 2;
  const neighborhoodOk = (state.neighborhood || '').trim().length >= 2;

  // Detecta se o GPS falhou/foi negado.
  const geoFailed = Boolean((geo as any).error) || (geo.source && geo.source !== 'gps');

  // [UX-merge] Confirmação implícita: basta cityOk + fonte conhecida.
  const hasReliableManualSource =
    state.location_source === 'cep' ||
    state.location_source === 'manual' ||
    state.location_source === 'gps' ||
    state.location_source === 'ip';
  const canFinish = cityOk && (hasReliableManualSource || geoFailed);

  const sourceLabel =
    state.location_source === 'gps' ? 'GPS preciso' :
    state.location_source === 'cep' ? 'CEP' :
    state.location_source === 'ip' ? 'aproximada (IP)' :
    state.location_source === 'manual' ? 'manual' :
    geo.source === 'gps' ? 'GPS' :
    geo.source === 'ip' ? 'aproximada (IP)' :
    geo.source === 'manual' ? 'manual' :
    geo.source === 'cache' ? 'salva' : null;

  // Validação cidade-base (cidade não pode ser regional / UF inválida).
  const baseCityIssues = validateBaseCityVsServiceArea({
    city: state.city,
    state: state.state,
    neighborhood: state.neighborhood || '',
  });
  const baseCityBlocked = hasBlockingBaseCityIssue(baseCityIssues);

  const gpsImprecise = gpsAccuracy != null && gpsAccuracy > 500;

  // Origem efetiva da localização — usada na UI e na telemetria.
  const effectiveSource: 'gps' | 'cep' | 'manual' | 'ip' | 'unknown' =
    state.location_source === 'gps' ? 'gps' :
    state.location_source === 'cep' ? 'cep' :
    state.location_source === 'manual' ? 'manual' :
    state.location_source === 'ip' ? 'ip' :
    geo.source === 'gps' ? 'gps' :
    geo.source === 'ip' ? 'ip' :
    geo.source === 'manual' ? 'manual' : 'unknown';

  async function onFinish() {
    if (!canFinish || submitting) return;
    if (baseCityBlocked) {
      toast.error('Verifique a cidade-base', {
        description: baseCityIssues[0]?.message || 'Cidade ou UF inválida.',
      });
      return;
    }
    setSubmitting(true);
    void trackOnboardingEvent({
      phase: 'pro_location' as any,
      event: 'submit',
      userId: user?.id || null,
      meta: {
        location_source: effectiveSource,
        geo_failed: Boolean(geoFailed),
        has_neighborhood: neighborhoodOk,
        gps_accuracy_m: gpsAccuracy,
      },
    });
    try { await finish(); } finally { setSubmitting(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-3 px-4 py-3"
    >
      <header className="space-y-2 text-center">
        <h1 className="font-display text-lg font-extrabold leading-tight text-foreground">
          De onde você é?
        </h1>
        <p className="text-xs text-muted-foreground">
          Sua cidade-base aparece para clientes próximos, e o bairro é sugerido quando houver dado confiável.
        </p>
      </header>

      {/* Aviso curto */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="leading-snug">
          A <strong>cidade-base</strong> deve ser o seu município (ex: <em>São José dos Pinhais</em>) — não a região metropolitana.
          Você poderá adicionar a região como <strong>área de atendimento</strong> depois.
        </p>
      </div>

      {/* Card único: Cidade-base + GPS embaixo */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Cidade-base
          </span>
          <span
            data-testid="location-source-pill"
            className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground/80"
          >
            Origem: {effectiveSource === 'gps' ? 'GPS' : effectiveSource === 'cep' ? 'CEP' : effectiveSource === 'manual' ? 'Manual' : effectiveSource === 'ip' ? 'IP (aproximada)' : 'Não definida'}
          </span>
          {awarded && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              +{BET_POINTS.city} pts
            </span>
          )}
        </div>
        <div className={`rounded-lg transition ${cityOk ? 'ring-2 ring-emerald-300/60 shadow-[0_0_14px_rgba(16,185,129,0.35)]' : ''}`}>
          <CityAutocomplete
            value={{ city: state.city, state: state.state }}
            onChange={handleCity}
            placeholder="Digite sua cidade"
            preferredUF={preferredUF}
            statusText={
              state.city
                ? sourceLabel
                  ? `Detectada via ${sourceLabel}. Edite se estiver errado.`
                  : undefined
                : preferredUF
                ? `Mostrando primeiro cidades de ${preferredUF}`
                : undefined
            }
          />
        </div>

        {baseCityIssues.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[11px] text-orange-700 dark:text-orange-300">
            {baseCityIssues.map((iss) => <li key={iss.code}>• {iss.message}</li>)}
          </ul>
        )}

        {/* Botão GPS posicionado logo abaixo do campo Cidade-base */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseGps}
          disabled={requestingGps}
          className="mt-3 w-full justify-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 disabled:opacity-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950/40"
        >
          <LocateFixed className={`h-4 w-4 ${requestingGps ? 'animate-pulse' : ''}`} />
          {requestingGps ? 'Detectando…' : state.location_source === 'gps' ? 'GPS confirmado — refinar' : 'Usar minha localização (GPS)'}
        </Button>

        {state.location_source === 'gps' && (
          <div className="mt-2 space-y-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="flex items-center gap-1 font-semibold">
              <CheckCircle2 className="h-3 w-3" />
              {gpsAccuracy != null && gpsAccuracy <= 100
                ? `GPS exato (±${Math.round(gpsAccuracy)}m)`
                : gpsAccuracy != null
                ? `GPS aproximado (±${Math.round(gpsAccuracy)}m)`
                : 'GPS confirmado'}
            </p>
            {geo.neighborhoodSource && geo.neighborhoodSource !== 'none' && (
              <p className="opacity-80">
                Bairro detectado via {geo.neighborhoodSource === 'bigdatacloud'
                  ? 'BigDataCloud'
                  : geo.neighborhoodSource === 'nominatim'
                  ? 'OpenStreetMap (fallback)'
                  : geo.neighborhoodSource === 'cep'
                  ? 'CEP'
                  : 'manual'}.
              </p>
            )}
          </div>
        )}
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

        <CepSuggestionCard
          city={state.city}
          state={state.state}
          neighborhood={state.neighborhood || ''}
          currentValue={state.postal_code || null}
          onApply={(cep) => applyCepSuggestion(cep)}
          phase="pro_location"
          userId={user?.id || null}
        />
      </div>

      {gpsImprecise && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50/70 p-3 text-xs text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-100">
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
        className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95 disabled:opacity-50"
      >
        {submitting ? 'Salvando…' : 'Finalizar cadastro express'}
        <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
      </Button>
    </motion.div>
  );
}
