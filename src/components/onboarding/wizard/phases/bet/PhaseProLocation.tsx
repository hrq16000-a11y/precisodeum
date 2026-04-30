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
import { ArrowRight, MapPin, Home, LocateFixed, Info, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
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
  // Prévia editável + confirmação. O GPS e o "Finalizar" ficam bloqueados
  // até o usuário revisar e confirmar a cidade aproximada e o bairro (se houver).
  const [previewCity, setPreviewCity] = useState('');
  const [previewState, setPreviewStateField] = useState('');
  const [previewNeighborhood, setPreviewNeighborhood] = useState('');
  const [previewConfirmed, setPreviewConfirmed] = useState<boolean>(() => state.location_source === 'gps');
  const previewSeededRef = useRef(false);

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
        // GPS confirmado também valida a prévia automaticamente.
        setPreviewConfirmed(true);
        setPreviewCity(result.city);
        setPreviewStateField(result.state);
        if (cleanNeighborhood) setPreviewNeighborhood(cleanNeighborhood);
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

  // Detecta se o GPS falhou/foi negado: hook indica erro ou source diferente de 'gps'
  // após uma tentativa explícita. Também consideramos negação quando geo.error existir.
  const geoFailed = Boolean((geo as any).error) || (geo.source && geo.source !== 'gps');

  // canFinish é tolerante a falha de GPS:
  //  - se a prévia foi confirmada explicitamente, libera (caminho feliz).
  //  - se o GPS falhou/foi negado mas o usuário tem cidade+UF válidos no state,
  //    libera (Hotfix #G2.3 — remove bloqueio invisível do previewSeededRef).
  const canFinish = cityOk && (previewConfirmed || geoFailed);
  const sourceLabel =
    state.location_source === 'gps' ? 'GPS preciso' :
    state.location_source === 'cep' ? 'CEP' :
    state.location_source === 'ip' ? 'aproximada (IP)' :
    state.location_source === 'manual' ? 'manual' :
    geo.source === 'gps' ? 'GPS' :
    geo.source === 'ip' ? 'aproximada (IP)' :
    geo.source === 'manual' ? 'manual' :
    geo.source === 'cache' ? 'salva' : null;

  const showPreview = !state.location_source || state.location_source !== 'gps';

  // Seed da prévia editável a partir do que já temos (state ou geo aproximado).
  useEffect(() => {
    if (previewSeededRef.current) return;
    const seedCity = state.city || geo.city || '';
    const seedState = state.state || geo.state || '';
    if (!seedCity && !seedState) return;
    previewSeededRef.current = true;
    setPreviewCity(seedCity);
    setPreviewStateField(seedState);
    const seedNeigh = sanitizeNeighborhood(state.neighborhood || geo.neighborhood, seedCity) || '';
    setPreviewNeighborhood(seedNeigh);
  }, [state.city, state.state, state.neighborhood, geo.city, geo.state, geo.neighborhood]);

  // Hotfix #G2.1 — Sincronização bidirecional:
  // Quando o usuário escolhe cidade manualmente via CityAutocomplete, propagamos
  // automaticamente para o estado da prévia, sem exigir digitação duplicada.
  // Marca a prévia como NÃO confirmada para forçar revisão consciente — exceto
  // se o GPS já tiver confirmado anteriormente.
  useEffect(() => {
    if (!state.city || !state.state) return;
    const cityChanged = state.city !== previewCity;
    const ufChanged = state.state !== previewState;
    if (cityChanged) setPreviewCity(state.city);
    if (ufChanged) setPreviewStateField(state.state);
    if ((cityChanged || ufChanged) && state.location_source !== 'gps') {
      setPreviewConfirmed(false);
    }
  }, [state.city, state.state, state.location_source]); // eslint-disable-line react-hooks/exhaustive-deps


  // Validação cidade-base vs área de atendimento (cidade não pode ser regional).
  const previewIssues = validateBaseCityVsServiceArea({
    city: previewCity,
    state: previewState,
    neighborhood: previewNeighborhood,
  });
  const previewBlocked = hasBlockingBaseCityIssue(previewIssues);

  function handleConfirmPreview() {
    if (previewBlocked) {
      toast.error('Verifique a cidade-base', {
        description: previewIssues[0]?.message || 'Cidade ou UF inválida.',
      });
      return;
    }
    const cleanNeigh = sanitizeNeighborhood(previewNeighborhood, previewCity) || '';
    const cityChanged = previewCity !== state.city || previewState !== state.state;
    patch({
      city: previewCity,
      state: previewState,
      neighborhood: cleanNeigh,
      ...(cityChanged ? { latitude: null, longitude: null, ibge_code: null } : {}),
      location_source: state.location_source ?? 'manual',
    });
    if (previewCity && previewState) awardCityOnce();
    setPreviewConfirmed(true);
    toast.success('Prévia confirmada', { description: 'Agora você pode refinar com GPS ou finalizar.' });
    void recordMyGeoEvent({
      event_type: 'manual_edit',
      source: state.location_source ?? 'manual',
      city: previewCity,
      state: previewState,
      neighborhood: cleanNeigh || null,
      status: 'logged',
    });
  }


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

      {/* Prévia EDITÁVEL — usuário precisa confirmar antes de habilitar GPS/Finalizar */}
      {showPreview && (
        <div className={`rounded-xl border p-3 text-xs ${previewConfirmed
          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100'
          : 'border-sky-200 bg-sky-50/70 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100'}`}>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide opacity-80">
            <Sparkles className="h-3.5 w-3.5" />
            {previewConfirmed ? 'Prévia confirmada' : 'Revise a prévia da sua localização'}
          </div>
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold opacity-80">Cidade aproximada</label>
              <div className="flex gap-2">
                <Input
                  value={previewCity}
                  onChange={(e) => { setPreviewCity(e.target.value); setPreviewConfirmed(false); }}
                  placeholder="Município"
                  className="h-8 flex-1 text-xs"
                  maxLength={120}
                />
                <Input
                  value={previewState}
                  onChange={(e) => { setPreviewStateField(e.target.value.toUpperCase().slice(0, 2)); setPreviewConfirmed(false); }}
                  placeholder="UF"
                  className="h-8 w-14 text-xs uppercase"
                  maxLength={2}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold opacity-80">
                Bairro <span className="opacity-60">(se disponível)</span>
              </label>
              <Input
                value={previewNeighborhood}
                onChange={(e) => { setPreviewNeighborhood(e.target.value); setPreviewConfirmed(false); }}
                placeholder="Ex: Centro — deixe vazio se não souber"
                className="h-8 text-xs"
                maxLength={80}
              />
            </div>
          </div>
          {previewIssues.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-rose-700 dark:text-rose-300">
              {previewIssues.map((iss) => <li key={iss.code}>• {iss.message}</li>)}
            </ul>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmPreview}
            disabled={previewConfirmed || previewBlocked}
            className="mt-2 h-8 w-full text-xs"
            variant={previewConfirmed ? 'secondary' : 'default'}
          >
            {previewConfirmed ? <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Confirmada</> : 'Confirmar prévia'}
          </Button>
          {!previewConfirmed && (
            <p className="mt-1.5 text-[11px] opacity-80">
              Confirme a prévia para liberar o GPS refinado e o botão de finalizar.
            </p>
          )}
        </div>
      )}

      {/* Aviso curto */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="leading-snug">
          A <strong>cidade-base</strong> deve ser o seu município (ex: <em>São José dos Pinhais</em>) — não a região metropolitana.
          Você poderá adicionar a região como <strong>área de atendimento</strong> depois.
        </p>
      </div>

      {/* Botão GPS — destravado só após confirmar a prévia */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleUseGps}
        disabled={requestingGps || !previewConfirmed}
        className="w-full justify-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 disabled:opacity-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950/40"
      >
        <LocateFixed className={`h-4 w-4 ${requestingGps ? 'animate-pulse' : ''}`} />
        {requestingGps ? 'Detectando…' : state.location_source === 'gps' ? 'GPS confirmado — refinar de novo' : !previewConfirmed ? 'Confirme a prévia para usar o GPS' : 'Usar minha localização (GPS refinado)'}
      </Button>


      {state.location_source === 'gps' && (
        <div className="-mt-2 space-y-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
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

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Cidade-base
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
                  ? `Detectada via ${sourceLabel}. Edite se estiver errado.`
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
