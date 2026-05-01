/**
 * CepSuggestionCard — UI dedicada para sugestão automática de CEP a partir
 * de cidade + UF + bairro (via ViaCEP).
 *
 * Estados visuais bem definidos:
 *  - idle:     entradas insuficientes (cidade ou bairro vazios) → renderiza nada
 *  - loading:  buscando no ViaCEP (debounce já aplicado pelo pai)
 *  - error:    network/timeout — mostra retry
 *  - notFound: ViaCEP retornou vazio para cidade+bairro
 *  - success:  match encontrado, aguardando confirmação do usuário
 *  - applied:  usuário aplicou — feedback persistente, oculta CTA
 *
 * Acessibilidade:
 *  - role="status" + aria-live="polite" para leitores de tela
 *  - botões com label explícito (Aplicar / Trocar / Tentar novamente)
 *
 * Privacidade: o componente é controlado — não persiste nada localmente.
 */
import { useEffect, useState } from 'react';
import { Search, Loader2, MapPin, AlertTriangle, Check, RotateCw } from 'lucide-react';
import { lookupCepFromCity } from '@/lib/cepReverseLookup';
import { startCepTimer, trackCepAttempt, type CepErrorCode } from '@/lib/locationTelemetry';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';

export interface CepSuggestionCardProps {
  city: string;
  state: string;
  neighborhood: string;
  /** Valor atual do CEP no estado do wizard (para detectar "já aplicado"). */
  currentValue?: string | null;
  /** Chamado quando o usuário confirma a aplicação do CEP. */
  onApply: (cep: string, hit: { city: string; state: string; neighborhood: string; street: string }) => void;
  /** Debounce em ms — útil para reduzir chamadas. Default: 600ms. */
  debounceMs?: number;
  /** Fase atual do wizard (para telemetria). Default: 'pro_location'. */
  phase?: string;
  /** ID do usuário (telemetria). */
  userId?: string | null;
}

type Status = 'idle' | 'loading' | 'success' | 'notFound' | 'error';

interface Hit {
  cep: string;
  city: string;
  state: string;
  neighborhood: string;
  street: string;
}

export default function CepSuggestionCard({
  city,
  state,
  neighborhood,
  currentValue,
  onApply,
  debounceMs = 600,
  phase = 'pro_location',
  userId = null,
}: CepSuggestionCardProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [hit, setHit] = useState<Hit | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const cityTrim = city.trim();
  const ufTrim = state.trim().toUpperCase();
  const bairroTrim = neighborhood.trim();
  const ready = cityTrim.length >= 2 && ufTrim.length === 2 && bairroTrim.length >= 3;

  useEffect(() => {
    if (!ready) {
      setStatus('idle');
      setHit(null);
      return;
    }
    let cancelled = false;
    setStatus('loading');
    const timer = startCepTimer();
    const t = scheduleWizardTimeout(
      { phase: phase as any, action: 'cep_suggestion_debounce' },
      async () => {
      try {
        const r = await lookupCepFromCity({
          city: cityTrim,
          state: ufTrim,
          neighborhood: bairroTrim,
        });
        if (cancelled) return;
        const latency_ms = timer.stop();
        if (r.ok === true) {
          setHit(r.match);
          setStatus('success');
          trackCepAttempt({
            phase,
            userId,
            ok: true,
            latency_ms,
            city_len: cityTrim.length,
            neighborhood_len: bairroTrim.length,
          });
        } else {
          setHit(null);
          const code: CepErrorCode = r.reason === 'not_found' ? 'not_found' : (r.reason as CepErrorCode);
          setStatus(code === 'not_found' ? 'notFound' : 'error');
          trackCepAttempt({
            phase,
            userId,
            ok: false,
            latency_ms,
            error_code: code,
            city_len: cityTrim.length,
            neighborhood_len: bairroTrim.length,
          });
        }
      } catch {
        if (!cancelled) {
          setHit(null);
          setStatus('error');
          trackCepAttempt({
            phase,
            userId,
            ok: false,
            latency_ms: timer.stop(),
            error_code: 'unknown',
            city_len: cityTrim.length,
            neighborhood_len: bairroTrim.length,
          });
        }
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [cityTrim, ufTrim, bairroTrim, ready, debounceMs, retryToken, phase, userId]);

  // Já aplicado — feedback discreto e fim.
  if (status === 'success' && hit && currentValue && currentValue.replace(/\D/g, '') === hit.cep.replace(/\D/g, '')) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
        data-testid="cep-suggestion-applied"
      >
        <Check className="h-3 w-3" /> CEP {hit.cep} aplicado.
      </p>
    );
  }

  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"
        data-testid="cep-suggestion-loading"
      >
        <Loader2 className="h-3 w-3 animate-spin" /> Procurando CEP de {bairroTrim}, {cityTrim}/{ufTrim}…
      </p>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-2 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50/70 p-2 text-[11px] text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100"
        data-testid="cep-suggestion-error"
      >
        <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
        <div className="flex-1 leading-snug">
          <p>Não consegui buscar o CEP agora.</p>
          <button
            type="button"
            onClick={() => setRetryToken((t) => t + 1)}
            className="mt-1 inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
          >
            <RotateCw className="h-3 w-3" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (status === 'notFound') {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-[11px] text-muted-foreground"
        data-testid="cep-suggestion-not-found"
      >
        CEP não localizado para esse bairro. Você pode digitar manualmente, se quiser.
      </p>
    );
  }

  // success → CTA de confirmação com preview da rua/bairro
  return (
    <div
      role="region"
      aria-label="Sugestão de CEP"
      className="mt-2 flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 dark:border-emerald-900/60 dark:bg-emerald-950/40"
      data-testid="cep-suggestion-success"
    >
      <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-700 dark:text-emerald-300" />
      <div className="flex-1 space-y-1">
        <p className="text-[11px] leading-snug text-emerald-900 dark:text-emerald-100">
          <span className="font-bold">CEP encontrado: {hit!.cep}</span>
          {hit!.street ? <> — {hit!.street}</> : null}
          <span className="block text-[10px] text-emerald-800/80 dark:text-emerald-200/80">
            {hit!.neighborhood}, {hit!.city}/{hit!.state}
          </span>
        </p>
        <button
          type="button"
          onClick={() => onApply(hit!.cep, hit!)}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700"
          data-testid="cep-suggestion-apply"
        >
          <Search className="h-3 w-3" /> Usar este CEP
        </button>
      </div>
    </div>
  );
}
