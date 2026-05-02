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
import { ArrowRight, MapPin, Home, LocateFixed, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
// GpsConsentNotice removido — GPS agora é solicitado automaticamente no mount.
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
  // gpsAccuracy local apenas espelha state.gps_accuracy_m para UI.
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(state.gps_accuracy_m ?? null);
  const geo = useGeoCity();
  const preferredUF = state.state || geo.state || '';
  const autoFilledRef = useRef(false);
  const cepLookupRef = useRef<string>('');
  // Auto-trigger do GPS uma única vez por montagem da fase. Se o usuário já
  // tem GPS no state, ou se o navegador não suporta geolocation, não faz nada.
  const gpsAutoTriggeredRef = useRef(false);
  // Foco programático no input de Bairro quando ele está vazio após hidratação.
  const neighborhoodInputRef = useRef<HTMLInputElement | null>(null);

  // Listener: BetModeShell despacha `wizard:focus-neighborhood` quando o
  // backend rejeita o upsert por trigger 22023 (PROVIDER_INCOMPLETE_NEIGHBORHOOD).
  // Trazemos o foco e damos um shake visual sem precisar de prop drilling.
  useEffect(() => {
    function focusBairro() {
      try {
        neighborhoodInputRef.current?.focus({ preventScroll: false } as any);
        neighborhoodInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch { /* noop */ }
    }
    window.addEventListener('wizard:focus-neighborhood', focusBairro);
    return () => window.removeEventListener('wizard:focus-neighborhood', focusBairro);
  }, []);

  // Auto-sugestão (não-destrutiva): pré-preenche cidade/UF se vazios.
  // Bairro só auto-preenche se vier sanitizado (≠ cidade, não-regional).
  useEffect(() => {
    if (autoFilledRef.current) return;
    if (state.city && state.city.trim().length > 0) return;
    if (geo.city && geo.state) {
      autoFilledRef.current = true;
      const cleanNeighborhood = sanitizeNeighborhood(geo.neighborhood, geo.city);
      const willFillNeighborhood = !(state.neighborhood && state.neighborhood.trim()) && !!cleanNeighborhood;
      const nbSource = willFillNeighborhood
        ? (geo.neighborhoodSource && geo.neighborhoodSource !== 'none'
            ? (geo.neighborhoodSource as BetState['neighborhood_source'])
            : null)
        : (state.neighborhood_source ?? null);
      patch({
        city: geo.city,
        state: geo.state,
        location_source: state.location_source ?? (geo.source === 'gps' ? 'gps' : 'ip'),
        ...(geo.latitude != null && geo.longitude != null
          ? { latitude: geo.latitude, longitude: geo.longitude }
          : {}),
        ...(willFillNeighborhood
          ? { neighborhood: cleanNeighborhood as string, neighborhood_source: nbSource }
          : {}),
      });
      // Log estruturado de persistência (auditoria local).
      // eslint-disable-next-line no-console
      console.info('[loc-persist] auto-fill', {
        city: geo.city,
        state: geo.state,
        neighborhood: willFillNeighborhood ? cleanNeighborhood : state.neighborhood,
        neighborhood_source: willFillNeighborhood ? nbSource : state.neighborhood_source,
        location_source: state.location_source ?? (geo.source === 'gps' ? 'gps' : 'ip'),
        gps_accuracy_m: state.gps_accuracy_m,
        precise: geo.source === 'gps',
        trigger: 'useEffect/passive',
      });
    }
  }, [geo.city, geo.state, geo.neighborhood, geo.neighborhoodSource, geo.latitude, geo.longitude, geo.source, state.city, state.neighborhood, state.neighborhood_source, state.location_source, state.gps_accuracy_m, patch]);

  function awardCityOnce() {
    if (state.rewards.city) return;
    awardReward('city', BET_POINTS.city);
    fieldWin();
  }

  // Auto-trigger do GPS no mount — sem botão. Solicita permissão nativa
  // imediatamente. Se negado/erro, segue silenciosamente com o fallback IP
  // já carregado por useGeoCity. Roda só uma vez por montagem.
  useEffect(() => {
    if (gpsAutoTriggeredRef.current) return;
    gpsAutoTriggeredRef.current = true;
    // Já temos GPS confirmado neste cadastro? Não pede de novo.
    if (state.location_source === 'gps') return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    // Dispara em microtask para garantir que o componente está montado.
    const id = window.setTimeout(() => { void handleUseGps(); }, 50);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Após hidratação inicial: se cidade-base já está OK e o bairro está vazio,
  // foca o input de bairro para o usuário continuar de imediato sem caçar o campo.
  useEffect(() => {
    const cityReady = !!state.city && !!state.state;
    const nbEmpty = !((state.neighborhood || '').trim());
    if (cityReady && nbEmpty && !requestingGps) {
      const id = window.setTimeout(() => {
        try { neighborhoodInputRef.current?.focus({ preventScroll: true } as any); } catch { /* noop */ }
      }, 250);
      return () => window.clearTimeout(id);
    }
  }, [state.city, state.state, state.neighborhood, requestingGps]);

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
    const value = e.target.value;
    patch({
      neighborhood: value,
      // Edição manual sempre carimba 'user' assim que houver conteúdo;
      // limpar o campo volta a fonte para null para o trigger DB cair em default.
      neighborhood_source: value.trim().length > 0 ? 'user' : null,
    });
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

    const willFillFromCep = !!cleanNeighborhood && !state.neighborhood?.trim();
    patch({
      city: r.city,
      state: r.state,
      ...(willFillFromCep
        ? { neighborhood: cleanNeighborhood as string, neighborhood_source: 'cep' }
        : {}),
      // BrasilAPI v2 traz ibge em data.city_ibge; lookupCep não expõe. Mantemos null aqui — o
      // backend fará a normalização final via sync_cidade trigger. Coordenadas só por GPS.
      location_source: 'cep',
    });
    // eslint-disable-next-line no-console
    console.info('[loc-persist] cep', {
      cep: norm,
      city: r.city,
      state: r.state,
      neighborhood: willFillFromCep ? cleanNeighborhood : state.neighborhood,
      neighborhood_source: willFillFromCep ? 'cep' : state.neighborhood_source,
      location_source: 'cep',
      precise: false,
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
        const acc = result.accuracyMeters ?? null;
        const willFillFromGps = !!cleanNeighborhood && !currentNeighborhood;
        const patchObj: Partial<BetState> = {
          city: result.city,
          state: result.state,
          latitude: geo.latitude,
          longitude: geo.longitude,
          location_source: 'gps',
          gps_accuracy_m: acc,
        };
        if (willFillFromGps) {
          patchObj.neighborhood = cleanNeighborhood as string;
          patchObj.neighborhood_source = 'gps';
        }
        patch(patchObj);
        setGpsAccuracy(acc);
        awardCityOnce();
        // eslint-disable-next-line no-console
        console.info('[loc-persist] gps', {
          city: result.city,
          state: result.state,
          neighborhood: willFillFromGps ? cleanNeighborhood : currentNeighborhood,
          neighborhood_source: willFillFromGps ? 'gps' : state.neighborhood_source,
          location_source: 'gps',
          gps_accuracy_m: acc,
          precise: acc != null && acc <= 100,
        });
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

  // [UX-merge] Confirmação implícita: basta cityOk + fonte conhecida OU dado já hidratado.
  // Quando o estado vem hidratado de um draft remoto / modo de edição / fase anterior,
  // location_source pode estar vazio, mas a cidade já foi validada antes — não trave o usuário.
  const hasReliableManualSource =
    state.location_source === 'cep' ||
    state.location_source === 'manual' ||
    state.location_source === 'gps' ||
    state.location_source === 'ip';
  const isHydratedFromDraft =
    cityOk && !hasReliableManualSource && !geoFailed;
  const canFinish = cityOk && (hasReliableManualSource || geoFailed || isHydratedFromDraft);


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

  // Guard síncrono — bloqueia cliques duplos antes do setState propagar.
  const submittingRef = useRef(false);
  async function onFinish() {
    if (submittingRef.current) return;
    if (!canFinish || submitting) return;
    if (baseCityBlocked) {
      toast.error('Verifique a cidade-base', {
        description: baseCityIssues[0]?.message || 'Cidade ou UF inválida.',
      });
      return;
    }
    submittingRef.current = true;
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
    try { await finish(); } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-md space-y-2 px-4 py-2"
    >
      <header className="space-y-1 text-center">
        <h1 className="font-display text-lg font-extrabold leading-tight text-foreground">
          De onde você é?
        </h1>
        <p className="text-[11px] text-muted-foreground">
          Use seu município (ex: <em>São José dos Pinhais</em>) — a região metropolitana entra depois como área de atendimento.
        </p>
      </header>

      {/* Card único: Cidade-base + status GPS compacto */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {requestingGps ? (
              <LocateFixed className="h-3.5 w-3.5 animate-pulse text-orange-600" aria-label="Detectando GPS" />
            ) : state.location_source === 'gps' ? (
              <LocateFixed
                className="h-3.5 w-3.5 text-emerald-600"
                aria-label={gpsAccuracy != null && gpsAccuracy <= 100 ? 'GPS preciso' : 'GPS aproximado'}
              />
            ) : (
              <MapPin className="h-3.5 w-3.5" aria-label="Localização aproximada por IP" />
            )}
            Cidade-base
            {cityOk && (
              <CheckCircle2
                className="h-3.5 w-3.5 text-emerald-600"
                aria-label="Cidade detectada com sucesso"
                data-testid="city-ok-check"
              />
            )}
          </span>
          <span
            data-testid="location-source-pill"
            className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground/80"
          >
            Origem: {effectiveSource === 'gps' ? 'GPS' : effectiveSource === 'cep' ? 'CEP' : effectiveSource === 'manual' ? 'Manual' : effectiveSource === 'ip' ? 'IP (aproximada)' : 'Não definida'}
          </span>
          {isHydratedFromDraft && (
            <span
              data-testid="location-prefilled-pill"
              className="rounded-full bg-bet-green-soft text-bet-green-fg border border-bet-green-border px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1"
            >
              <CheckCircle2 className="h-3 w-3" /> Já preenchido — pode avançar
            </span>
          )}
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

        {/* Link discreto para retentar GPS — sem ocupar espaço vertical extra. */}
        {state.location_source !== 'gps' && (
          <button
            type="button"
            onClick={handleUseGps}
            disabled={requestingGps}
            aria-label="Tentar localização por GPS"
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-orange-300"
          >
            <LocateFixed className={`h-3 w-3 ${requestingGps ? 'animate-pulse' : ''}`} />
            {requestingGps ? 'Detectando…' : 'Usar GPS preciso'}
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
        <label htmlFor="neighborhood" className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <Home className="h-3.5 w-3.5" /> Bairro
        </label>
        <Input
          id="neighborhood"
          ref={neighborhoodInputRef}
          value={state.neighborhood}
          onChange={handleNeighborhood}
          placeholder="Ex: Centro, Batel, Afonso Pena"
          autoComplete="address-level3"
          maxLength={80}
          className={neighborhoodOk ? 'ring-2 ring-bet-green/60' : ''}
        />
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
