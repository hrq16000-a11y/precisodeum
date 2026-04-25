import { useMemo } from 'react';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PhoneMaskedInput from '@/components/PhoneMaskedInput';
import CpfCnpjInput from '@/components/onboarding/CpfCnpjInput';
import { validateWhatsapp } from '@/lib/whatsapp';
import { isValidCpfCnpj } from '@/lib/cpfCnpj';
import type { ProfileWizardData } from './types';

interface Step3IdentificationProps {
  data: ProfileWizardData;
  onChange: (patch: Partial<ProfileWizardData>) => void;
  /** onBlur do WhatsApp — dispara checagem remota de duplicidade. */
  onWhatsappBlur: () => void;
  /** onBlur do CPF/CNPJ — dispara checagem remota de duplicidade. */
  onDocumentBlur: () => void;
  /** Estados externos da checagem (vindos do useWizardDuplicateCheck). */
  checking: { whatsapp: boolean; tax_id: boolean };
  duplicates: { whatsapp: boolean; tax_id: boolean };
}

/**
 * Step 3 — Identificação (nome, WhatsApp, CPF/CNPJ).
 *
 * Portado do `SmartOnboardingWizard.Step3Contact`, mantendo paridade visual
 * mas integrado ao shell modular do `ProfileWizard`. A validação inline de
 * duplicidade é orquestrada pelo shell via `useWizardDuplicateCheck`; este
 * componente apenas exibe os estados (`checking`, `duplicates`) e dispara
 * `onWhatsappBlur` / `onDocumentBlur` no momento certo.
 *
 * Travas de avanço:
 *  - Nome obrigatório (mín 2 chars).
 *  - WhatsApp válido (validateWhatsapp).
 *  - CPF/CNPJ — opcional, mas se preenchido precisa ser válido.
 *  - Duplicidade no banco bloqueia o avanço (controlada pelo shell).
 */
const Step3Identification = ({
  data,
  onChange,
  onWhatsappBlur,
  onDocumentBlur,
  checking,
  duplicates,
}: Step3IdentificationProps) => {
  const docMode: 'cpf' | 'cnpj' = data.kind === 'pj' ? 'cnpj' : 'cpf';
  const taxLabel = docMode === 'cnpj' ? 'CNPJ' : 'CPF';
  const taxDigits = (data.document || '').replace(/\D/g, '');
  const taxFilled = taxDigits.length > 0;
  const expectedLen = docMode === 'cnpj' ? 14 : 11;
  const taxValid = !taxFilled || (taxDigits.length === expectedLen && isValidCpfCnpj(taxDigits));

  const waCheck = useMemo(() => validateWhatsapp(data.whatsapp || ''), [data.whatsapp]);
  const waTouched = (data.whatsapp || '').length > 0;
  const nameValid = (data.full_name || '').trim().length >= 2;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Identificação</h2>
        <p className="text-xs text-muted-foreground">
          Como os clientes vão te encontrar e identificar.
        </p>
      </div>

      {/* Nome */}
      <div>
        <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
          Seu nome completo
          <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <Input
          placeholder="Ex: João Silva"
          value={data.full_name}
          onChange={(e) => onChange({ full_name: e.target.value })}
          aria-invalid={!nameValid && (data.full_name || '').length > 0}
          className={
            !nameValid && (data.full_name || '').length > 0
              ? 'border-destructive focus-visible:ring-destructive'
              : ''
          }
        />
      </div>

      {/* WhatsApp */}
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          WhatsApp <span className="text-destructive" aria-hidden="true">*</span>
          <span className="ml-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-destructive">
            Obrigatório
          </span>
        </label>
        <div onBlur={onWhatsappBlur}>
          <PhoneMaskedInput
            name="whatsapp"
            value={data.whatsapp}
            onChange={(_n, val) => onChange({ whatsapp: val })}
            className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground ${
              (waTouched && !waCheck.valid) || duplicates.whatsapp
                ? 'border-destructive focus-visible:ring-destructive'
                : 'border-input'
            }`}
          />
        </div>
        {checking.whatsapp ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Verificando WhatsApp...
          </p>
        ) : duplicates.whatsapp ? (
          <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Este WhatsApp já está cadastrado em outra conta.</span>
          </p>
        ) : waTouched && !waCheck.valid ? (
          <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{waCheck.message}</span>
          </p>
        ) : waTouched && waCheck.valid ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> WhatsApp válido.
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Inclua DDD. Ex: (41) 99745-2053.
          </p>
        )}
      </div>

      {/* CPF/CNPJ */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="block text-xs font-semibold text-foreground">{taxLabel}</label>
          <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Documento opcional
          </span>
        </div>
        <CpfCnpjInput
          mode={docMode}
          value={data.document || ''}
          onChange={(digitsOnly) => onChange({ document: digitsOnly })}
          onBlur={onDocumentBlur}
          aria-invalid={!taxValid || duplicates.tax_id}
          className={
            !taxValid || duplicates.tax_id
              ? 'border-destructive focus-visible:ring-destructive'
              : ''
          }
        />
        {checking.tax_id ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Verificando {taxLabel}...
          </p>
        ) : duplicates.tax_id ? (
          <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Este {taxLabel} já está cadastrado em outra conta.</span>
          </p>
        ) : (
          <p
            className={`mt-1 text-[11px] ${
              !taxValid
                ? 'text-destructive'
                : taxFilled
                  ? 'text-emerald-600'
                  : 'text-muted-foreground'
            }`}
          >
            {!taxValid
              ? `${taxLabel} inválido — confira os dígitos.`
              : taxFilled
                ? `${taxLabel} válido. Será salvo de forma criptografada.`
                : `Opcional — pode preencher depois. ${taxLabel} soma pontos no ranking.`}
          </p>
        )}
      </div>

      {/* Resumo PF/PJ */}
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        Cadastro como{' '}
        <span className="font-semibold text-foreground">
          {data.kind === 'pj' ? 'Empresa/MEI (PJ)' : 'Autônomo (PF)'}
        </span>
      </div>
    </div>
  );
};

export default Step3Identification;

/** Validação local usada pelo shell para liberar o botão "Avançar". */
export function isStep3Valid(data: ProfileWizardData): boolean {
  const nameOk = (data.full_name || '').trim().length >= 2;
  const waOk = validateWhatsapp(data.whatsapp || '').valid;
  const taxDigits = (data.document || '').replace(/\D/g, '');
  if (taxDigits.length === 0) return nameOk && waOk;
  const expectedLen = data.kind === 'pj' ? 14 : 11;
  const taxOk = taxDigits.length === expectedLen && isValidCpfCnpj(taxDigits);
  return nameOk && waOk && taxOk;
}
