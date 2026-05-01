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
import { MapPin, Store, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { lookupCep, formatCep, onlyDigits } from '@/lib/cepLookup';

export interface CompanyAddressValue {
  street?: string;
  street_number?: string;
  complement?: string;
  postal_code?: string;
  show_full_address?: boolean;
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
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'applied' | 'error'>('idle');
  const lastCepRef = useRef<string>('');

  const isSuggested = (k: keyof CompanyAddressValue) => suggestedFields.includes(k);

  // Validações inline, não-bloqueantes (só sinalizam quando o usuário digitou algo inválido).
  const streetRaw = (value.street ?? '').trim();
  const numberRaw = (value.street_number ?? '').trim();
  const cepDigits = onlyDigits(value.postal_code ?? '');
  const streetError = streetRaw.length > 0 && streetRaw.length < 3
    ? 'Logradouro muito curto — informe pelo menos 3 caracteres.'
    : '';
  const numberError = numberRaw.length > 0 && !/^([0-9]{1,6}|s\/?n|sn)$/i.test(numberRaw)
    ? 'Número inválido — use só dígitos ou "S/N".'
    : '';
  const cepError = cepDigits.length > 0 && cepDigits.length < 8
    ? 'CEP incompleto — precisa ter 8 dígitos.'
    : '';

  // Lookup automático quando o CEP atinge 8 dígitos
  useEffect(() => {
    const digits = onlyDigits(value.postal_code ?? '');
    if (digits.length !== 8) {
      if (cepStatus !== 'idle') setCepStatus('idle');
      return;
    }
    if (digits === lastCepRef.current) return;
    lastCepRef.current = digits;
    let cancelled = false;
    setCepStatus('loading');
    (async () => {
      const r = await lookupCep(digits);
      if (cancelled) return;
      if (r.ok) {
        // Só preenche street se ainda estiver vazio (não sobrescreve digitação do usuário)
        const patch: Partial<CompanyAddressValue> = {};
        if (!value.street && r.address) patch.street = r.address;
        if (Object.keys(patch).length > 0) onChange(patch);
        setCepStatus('applied');
      } else {
        setCepStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.postal_code]);

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
            onChange={(e) => onChange({ street: e.target.value })}
            placeholder="Rua / Avenida"
            maxLength={120}
            className={isSuggested('street') && value.street ? inputSuggested : inputBase}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Nº
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={value.street_number ?? ''}
            onChange={(e) => onChange({ street_number: e.target.value.replace(/[^\dA-Za-z/-]/g, '').slice(0, 10) })}
            placeholder="123"
            className={inputBase}
          />
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
            {cepStatus === 'error' && (
              <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700">
                Não encontrado
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
            className={
              isSuggested('postal_code') && value.postal_code ? inputSuggested : inputBase
            }
          />
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
