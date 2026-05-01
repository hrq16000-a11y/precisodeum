/**
 * CompanyAddressForm — Formulário ISOLADO de endereço/identidade PJ.
 *
 * Objetivo: oferecer um único componente reutilizável para coletar dados
 * institucionais opcionais (endereço físico + identidade) de prestadores PJ.
 *
 * UX (achatado por pedido):
 *  - Logradouro e Número ficam SEMPRE na mesma linha (mobile inclusive).
 *  - CEP com máscara 00000-000 + autocomplete on-blur via BrasilAPI/ViaCEP,
 *    preenchendo o campo "street" automaticamente quando estiver vazio.
 *  - Sugestões pré-existentes vindas de GPS/IP/conta aparecem com badge
 *    "Sugerido — confirme" para o usuário só confirmar.
 *
 * REGRAS DE SEGURANÇA:
 *  - NÃO é usado por fluxos de RH (que têm seu próprio formulário).
 *  - É totalmente controlado — não persiste sozinho.
 *  - Todos os campos são OPCIONAIS.
 */
import { MapPin, Store, ChevronDown, Sparkles, Loader2, RotateCw, Check, AlertTriangle, History } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { lookupCep, formatCep, onlyDigits } from '@/lib/cepLookup';
import { normalizeStreet as robustNormalizeStreet, isSameStreet } from '@/lib/streetNormalize';

export interface CompanyAddressValue {
  street?: string;
  street_number?: string;
  complement?: string;
  postal_code?: string;
  show_full_address?: boolean;
  /** Última sugestão de logradouro vinda do CEP — para o passo seguinte saber que foi sugerido. */
  street_suggested?: string;
  /** CEP (8 dígitos) que originou a sugestão atual — auditoria/telemetria + anti-sobrescrita. */
  street_suggested_cep?: string;
  /** Usuário confirmou explicitamente o logradouro (clicou "Usar este" ou digitou). */
  street_confirmed?: boolean;
}

interface Props {
  value: CompanyAddressValue;
  onChange: (patch: Partial<CompanyAddressValue>) => void;
  /** Cidade/bairro do prestador (apenas para preview do toggle de privacidade). */
  cityPreview?: { city?: string; neighborhood?: string };
  /** Quando true, inicia colapsado com botão "Adicionar endereço". */
  collapsible?: boolean;
  /** Texto do botão de revelação (collapsible mode). */
  revealLabel?: string;
  /** Marca campos pré-preenchidos por GPS/IP/conta como "Sugerido — confirme". */
  suggestedFields?: Array<keyof CompanyAddressValue>;
}

/** Máscara visível 00000-000 a partir de até 8 dígitos. */
function maskCep(digits: string): string {
  const d = onlyDigits(digits).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Normalização robusta delegada a `@/lib/streetNormalize`. Cobre acentos,
 * pontuação, abreviações ("R.", "Av.", "Tv.") e stopwords ("de", "da").
 */
function normalizeStreet(s: string): string {
  return robustNormalizeStreet(s);
}

/** Item do histórico recente de CEPs consultados nesta sessão do form. */
interface CepHistoryEntry {
  cep: string;        // 00000-000
  digits: string;     // 8 dígitos
  address?: string;   // logradouro sugerido
  city?: string;
  state?: string;
}

export default function CompanyAddressForm({
  value,
  onChange,
  cityPreview,
  collapsible = false,
  revealLabel = 'Adicionar endereço do ponto de atendimento físico',
  suggestedFields = [],
}: Props) {
  const hasContent = Boolean(
    value.street || value.street_number || value.postal_code || value.complement,
  );
  const [open, setOpen] = useState(!collapsible || hasContent);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'applied' | 'error' | 'not_found'>('idle');
  const [cepErrorReason, setCepErrorReason] = useState<'network' | 'not_found' | null>(null);
  const lastCepRef = useRef<string>('');
  /**
   * Histórico recente de CEPs consultados com sucesso nesta sessão (máx 3).
   * Permite o usuário reaplicar uma sugestão rapidamente após retry / edição.
   */
  const [cepHistory, setCepHistory] = useState<CepHistoryEntry[]>([]);

  const isSuggested = (k: keyof CompanyAddressValue) => suggestedFields.includes(k);

  // Validações inline, não-bloqueantes (só sinalizam quando o usuário digitou algo inválido).
  const streetRaw = (value.street ?? '').trim();
  const numberRaw = (value.street_number ?? '').trim();
  const cepDigits = onlyDigits(value.postal_code ?? '');
  const streetError = streetRaw.length > 0 && streetRaw.length < 3
    ? 'Logradouro muito curto — informe pelo menos 3 caracteres.'
    : '';
  // Número: aceita só dígitos (até 6) ou "S/N"/"SN". Mensagens distintas para tamanho vs formato.
  const numberError = (() => {
    if (numberRaw.length === 0) return '';
    if (numberRaw.length > 10) return 'Número muito longo — máximo 10 caracteres.';
    if (!/^([0-9]{1,6}|s\/?n|sn)$/i.test(numberRaw)) return 'Número inválido — use só dígitos (até 6) ou "S/N".';
    return '';
  })();
  const cepError = cepDigits.length > 0 && cepDigits.length < 8
    ? 'CEP incompleto — precisa ter 8 dígitos.'
    : '';
  const cepHint = cepDigits.length > 0 && cepDigits.length < 8
    ? `Digite mais ${8 - cepDigits.length} dígito${8 - cepDigits.length === 1 ? '' : 's'} para buscar automaticamente.`
    : '';

  /** Faz o lookup de fato e propaga o resultado. Reutilizado pelo botão "Tentar de novo". */
  const runLookup = useCallback(async (digits: string) => {
    setCepStatus('loading');
    setCepErrorReason(null);
    const r = await lookupCep(digits);
    if (r.ok) {
      const suggestion = r.address ?? '';
      // Persiste a sugestão + o CEP que a originou — auditoria/telemetria + anti-sobrescrita.
      const patch: Partial<CompanyAddressValue> = {
        street_suggested: suggestion,
        street_suggested_cep: digits,
      };
      const currentStreet = (value.street ?? '').trim();
      const userTyped = currentStreet.length > 0;
      const userConfirmed = Boolean(value.street_confirmed);
      const previousSuggestion = (value.street_suggested ?? '').trim();
      // Caso 1: campo vazio → preenche e marca como NÃO confirmado.
      if (suggestion && !userTyped) {
        patch.street = suggestion;
        patch.street_confirmed = false;
      } else if (
        // Caso 2: usuário ainda não confirmou e tinha a sugestão anterior — atualiza para a nova.
        suggestion &&
        userTyped &&
        !userConfirmed &&
        previousSuggestion.length > 0 &&
        isSameStreet(currentStreet, previousSuggestion)
      ) {
        patch.street = suggestion;
        patch.street_confirmed = false;
      }
      // Caso 3: usuário confirmou ou digitou diferente → mantém o que está e deixa o conflict banner agir.
      onChange(patch);
      setCepStatus('applied');

      // Atualiza histórico (LRU, máx 3) — apenas quando há logradouro útil.
      if (suggestion) {
        setCepHistory((prev) => {
          const entry: CepHistoryEntry = {
            cep: formatCep(digits),
            digits,
            address: suggestion,
            city: r.city,
            state: r.state,
          };
          const dedup = prev.filter((e) => e.digits !== digits);
          return [entry, ...dedup].slice(0, 3);
        });
      }
    } else {
      const failure = r as { ok: false; reason: 'invalid_format' | 'not_found' | 'network'; message: string };
      const reason: 'network' | 'not_found' = failure.reason === 'not_found' ? 'not_found' : 'network';
      setCepStatus(reason === 'not_found' ? 'not_found' : 'error');
      setCepErrorReason(reason);
    }
  }, [onChange, value.street, value.street_confirmed, value.street_suggested]);

  // Lookup automático SOMENTE quando o CEP atinge EXATAMENTE 8 dígitos.
  useEffect(() => {
    const digits = onlyDigits(value.postal_code ?? '');
    if (digits.length !== 8) {
      if (cepStatus !== 'idle') setCepStatus('idle');
      return;
    }
    if (digits === lastCepRef.current) return;
    lastCepRef.current = digits;
    void runLookup(digits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.postal_code]);

  // Detecção de conflito: usuário digitou street e o CEP sugere algo diferente.
  const suggestion = (value.street_suggested ?? '').trim();
  const hasUserStreet = streetRaw.length >= 3;
  const conflict =
    cepStatus === 'applied' &&
    suggestion.length > 0 &&
    hasUserStreet &&
    normalizeStreet(suggestion) !== normalizeStreet(streetRaw);

  // Sugestão pendente de confirmação: street veio do CEP e o usuário ainda não confirmou.
  const pendingConfirmation =
    cepStatus === 'applied' &&
    suggestion.length > 0 &&
    !value.street_confirmed &&
    !conflict &&
    normalizeStreet(suggestion) === normalizeStreet(streetRaw);

  const acceptSuggestion = () => {
    onChange({ street: suggestion, street_confirmed: true });
  };
  const rejectSuggestion = () => {
    // Limpa o campo para o usuário digitar manualmente, mas mantém o que foi sugerido para auditoria.
    onChange({ street: '', street_confirmed: false });
  };
  const retryLookup = () => {
    if (cepDigits.length === 8) {
      lastCepRef.current = ''; // força re-execução
      void runLookup(cepDigits);
    }
  };

  /**
   * Reaplica uma sugestão a partir do histórico recente: repõe o CEP e o
   * logradouro sugerido em UM patch, marca como NÃO-confirmado para o usuário
   * confirmar explicitamente. Útil quando o usuário fez retry / editou o CEP
   * e quer voltar a um valor já consultado.
   */
  const reapplyFromHistory = (entry: CepHistoryEntry) => {
    lastCepRef.current = entry.digits; // evita re-disparar lookup automático
    setCepStatus('applied');
    setCepErrorReason(null);
    onChange({
      postal_code: entry.digits,
      street: entry.address ?? '',
      street_suggested: entry.address ?? '',
      street_suggested_cep: entry.digits,
      street_confirmed: false,
    });
  };

  const inputBase =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30';
  const inputSuggested =
    'w-full rounded-lg border-2 border-amber-300 bg-amber-50/50 px-3 py-2 text-sm text-foreground outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40';

  const SuggestedTag = () => (
    <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
      <Sparkles className="h-2.5 w-2.5" /> Sugerido
    </span>
  );

  const fields = (
    <div className="space-y-2">
      {/* Histórico recente de CEPs consultados — permite reaplicar uma sugestão rapidamente. */}
      {cepHistory.length > 0 && (
        <div
          data-testid="cep-history"
          className="rounded-lg border border-border/60 bg-muted/30 p-2"
        >
          <div className="mb-1 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
            <History className="h-3 w-3" aria-hidden="true" /> CEPs recentes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cepHistory.map((entry) => {
              const isActive = entry.digits === cepDigits;
              return (
                <button
                  key={entry.digits}
                  type="button"
                  onClick={() => reapplyFromHistory(entry)}
                  data-testid={`cep-history-item-${entry.digits}`}
                  aria-label={`Reaplicar CEP ${entry.cep}${entry.address ? ` — ${entry.address}` : ''}`}
                  className={`group inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                    isActive
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                      : 'border-border bg-background text-foreground hover:border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <span className="font-mono">{entry.cep}</span>
                  {entry.address && (
                    <span className="truncate text-muted-foreground group-hover:text-foreground">
                      · {entry.address}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* Banner de SUGESTÃO PENDENTE — usuário precisa confirmar o logradouro vindo do CEP. */}
      {pendingConfirmation && (
        <div
          data-testid="cep-suggestion-banner"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[12px] leading-snug"
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">Sugerido pelo CEP — confirme:</p>
            <p className="text-amber-800">{suggestion}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={acceptSuggestion}
                data-testid="cep-suggestion-accept"
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
              >
                <Check className="h-3 w-3" /> Usar este
              </button>
              <button
                type="button"
                onClick={rejectSuggestion}
                data-testid="cep-suggestion-reject"
                className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
              >
                Editar manualmente
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Banner de CONFLITO — usuário digitou logradouro diferente do que o CEP sugere. */}
      {conflict && (
        <div
          data-testid="cep-conflict-banner"
          className="flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-50 p-2 text-[12px] leading-snug"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">Confira: o CEP sugere outra rua.</p>
            <p className="text-amber-800">
              Você digitou <span className="font-semibold">{streetRaw}</span>, mas o CEP indica{' '}
              <span className="font-semibold">{suggestion}</span>.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={acceptSuggestion}
                data-testid="cep-conflict-accept-suggestion"
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
              >
                Usar a do CEP
              </button>
              <button
                type="button"
                onClick={() => onChange({ street_confirmed: true })}
                data-testid="cep-conflict-keep-typed"
                className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
              >
                Manter o que digitei
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Logradouro + Número SEMPRE na mesma linha (achatado) */}
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3 w-3" /> Logradouro
            {isSuggested('street') && value.street ? <SuggestedTag /> : null}
          </span>
          <input
            type="text"
            value={value.street ?? ''}
            onChange={(e) => onChange({ street: e.target.value, street_confirmed: true })}
            placeholder="Rua / Avenida"
            maxLength={120}
            aria-invalid={!!streetError}
            aria-describedby={streetError ? 'street-error' : undefined}
            className={isSuggested('street') && value.street ? inputSuggested : inputBase}
          />
          {streetError && (
            <p id="street-error" className="mt-1 text-[10.5px] text-rose-600">{streetError}</p>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Nº
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={value.street_number ?? ''}
            onChange={(e) => onChange({ street_number: e.target.value.replace(/[^\dA-Za-z/-]/g, '').slice(0, 14) })}
            placeholder="123"
            aria-invalid={!!numberError}
            aria-describedby={numberError ? 'number-error' : undefined}
            className={inputBase}
          />
          {numberError && (
            <p id="number-error" className="mt-1 text-[10.5px] text-rose-600">{numberError}</p>
          )}
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Complemento
          </span>
          <input
            type="text"
            value={value.complement ?? ''}
            onChange={(e) => onChange({ complement: e.target.value.slice(0, 60) })}
            placeholder="Sala / Bloco (opcional)"
            className={inputBase}
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            CEP
            {cepStatus === 'loading' && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
            {cepStatus === 'applied' && (
              <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                Aplicado
              </span>
            )}
            {(cepStatus === 'error' || cepStatus === 'not_found') && (
              <span
                data-testid="cep-error-badge"
                className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700"
              >
                {cepStatus === 'not_found' ? 'CEP não encontrado' : 'Falha de rede'}
              </span>
            )}
            {isSuggested('postal_code') && value.postal_code ? <SuggestedTag /> : null}
          </span>
          <input
            type="tel"
            inputMode="numeric"
            value={maskCep(value.postal_code ?? '')}
            onChange={(e) => onChange({ postal_code: onlyDigits(e.target.value).slice(0, 8) })}
            placeholder="00000-000"
            maxLength={9}
            aria-invalid={!!cepError}
            aria-describedby={cepError ? 'cep-error' : undefined}
            className={
              isSuggested('postal_code') && value.postal_code ? inputSuggested : inputBase
            }
          />
          {cepError && (
            <p id="cep-error" className="mt-1 text-[10.5px] text-rose-600">{cepError}</p>
          )}
          {!cepError && cepHint && (
            <p data-testid="cep-hint" className="mt-1 text-[10.5px] text-muted-foreground">{cepHint}</p>
          )}
          {(cepStatus === 'error' || cepStatus === 'not_found') && (
            <div className="mt-1 flex items-start gap-1.5 rounded-md border border-rose-200 bg-rose-50 p-1.5 text-[10.5px] leading-snug text-rose-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                {cepErrorReason === 'not_found'
                  ? 'Não encontramos esse CEP nas bases públicas (BrasilAPI / ViaCEP). Confira os dígitos ou preencha o logradouro manualmente.'
                  : 'Não conseguimos consultar o CEP agora — pode ser falha de rede. Você pode tentar novamente ou preencher manualmente.'}
                <button
                  type="button"
                  onClick={retryLookup}
                  data-testid="cep-retry"
                  className="ml-1 inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <RotateCw className="h-2.5 w-2.5" /> Tentar de novo
                </button>
              </div>
            </div>
          )}
        </label>
      </div>
      <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-lg bg-background/60 p-2 text-[11px] leading-snug text-foreground">
        <input
          type="checkbox"
          checked={Boolean(value.show_full_address)}
          onChange={(e) => onChange({ show_full_address: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          <span className="font-semibold">Exibir endereço completo no perfil público.</span>{' '}
          <span className="text-muted-foreground">
            Se desativado, mostramos apenas “Ponto de atendimento físico em{' '}
            {cityPreview?.neighborhood || 'seu bairro'}, {cityPreview?.city || 'sua cidade'}”.
          </span>
        </span>
      </label>
    </div>
  );

  if (!collapsible) return fields;

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 text-left text-[12px] leading-snug text-foreground transition hover:text-accent"
      >
        <Store className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span className="flex-1">
          <span className="font-semibold">{revealLabel}</span>{' '}
          <span className="text-muted-foreground">(oficina, salão, loja). Opcional.</span>
        </span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="addr"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden pt-1"
          >
            {fields}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
