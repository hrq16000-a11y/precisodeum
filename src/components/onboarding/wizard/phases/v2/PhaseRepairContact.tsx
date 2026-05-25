/**
 * PhaseRepairContact — fase auxiliar do wizard V2.
 *
 * NÃO faz parte do PHASE_ORDER linear. É aberta exclusivamente quando o
 * shell detecta que falta um dado de contato obrigatório (WhatsApp/nome/
 * cidade) e não há outra fase do fluxo principal que colete esse campo
 * (a triagem Bet Mode normalmente já cobre, mas se o usuário pulou pelo
 * caminho errado ou um draft ficou parcial, esta tela é a saída segura).
 *
 * Containment patch (Crítico #1 do stop-loss). Mantém o escopo MÍNIMO:
 *  - 1 input WhatsApp + máscara BR + validação local
 *  - Botão "Salvar e voltar" → patch + RETURN_FROM_REPAIR
 *
 * Não altera schema, não consulta backend, não toca em fotos/upload/etc.
 */

import { useMemo, useState } from 'react';
import { Loader2, ArrowLeft, ArrowRight, Phone, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  normalizeOnboardingPhone,
  isOnboardingWhatsappValid,
} from './contactValidation';
import { toDisplayPhoneBR } from '@/lib/validation/phoneNormalization';
import type { OnboardingProfileData } from './types';

interface PhaseRepairContactProps {
  profile: OnboardingProfileData;
  /** Campo que motivou a abertura: 'whatsapp' | 'full_name' | 'city' (telemetria/copy). */
  focusField?: string | null;
  saving?: boolean;
  onSave: (patch: Partial<OnboardingProfileData>) => void;
  onCancel: () => void;
}

export const PhaseRepairContact = ({
  profile,
  focusField,
  saving = false,
  onSave,
  onCancel,
}: PhaseRepairContactProps) => {
  const [whatsappRaw, setWhatsappRaw] = useState<string>(profile.whatsapp || '');
  const [touched, setTouched] = useState(false);

  const digits = useMemo(() => normalizeOnboardingPhone(whatsappRaw), [whatsappRaw]);
  const valid = isOnboardingWhatsappValid(whatsappRaw);
  const showError = touched && !valid;

  const handleSubmit = () => {
    setTouched(true);
    if (!valid) return;
    // Persiste o WhatsApp normalizado (somente dígitos) no reducer.
    onSave({ whatsapp: digits });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-md space-y-4 px-4 py-3"
      role="region"
      aria-labelledby="phase-repair-title"
    >
      <header className="space-y-2 text-center">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
          <Phone className="h-5 w-5" />
        </div>
        <h1 id="phase-repair-title" className="font-display text-lg font-extrabold leading-tight text-foreground">
          Falta seu WhatsApp para publicar
        </h1>
        <p className="text-xs text-muted-foreground">
          Sem WhatsApp os clientes não conseguem te contatar. Informe agora e voltamos
          para onde você parou — nenhum dado já preenchido será perdido.
        </p>
      </header>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
        <div>
          <Label htmlFor="repair-whatsapp" className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> WhatsApp com DDD
          </Label>
          <Input
            id="repair-whatsapp"
            data-onboarding-field="whatsapp"
            data-testid="repair-whatsapp-input"
            autoFocus
            inputMode="tel"
            placeholder="(11) 99999-9999"
            value={toDisplayPhoneBR(whatsappRaw) || whatsappRaw}
            onChange={(e) => { setWhatsappRaw(e.target.value); if (!touched) setTouched(true); }}
            onBlur={() => setTouched(true)}
            aria-invalid={showError || undefined}
            className={`h-11 ${showError ? 'border-destructive ring-4 ring-destructive/40 animate-pulse' : valid && touched ? 'border-emerald-500 ring-2 ring-emerald-300/40' : ''}`}
          />
          {showError && (
            <p className="mt-1 inline-flex items-start gap-1 text-[11px] text-destructive">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              Informe um WhatsApp válido com DDD (10 ou 11 dígitos).
            </p>
          )}
          {focusField === 'whatsapp' && !touched && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Você foi direcionado aqui porque esse campo estava em branco.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={saving}
          aria-disabled={saving || !valid}
          data-testid="repair-save-btn"
          className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar e voltar
          <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-xs text-muted-foreground"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Voltar sem corrigir agora
        </Button>
      </div>
    </motion.div>
  );
};

export default PhaseRepairContact;
