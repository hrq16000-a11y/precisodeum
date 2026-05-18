import { normalizePhoneBR } from '@/lib/validation/phoneNormalization';

export function normalizeOnboardingPhone(value: unknown): string {
  // Fase 1.3: delega à fonte única. Mantém o contrato anterior (string vazia
  // se inválido) e o formato canônico 55DDDNUMBER usado pelo wizard V2.
  return normalizePhoneBR(value);
}

import { isValidFullName } from '@/lib/validation/fullNameValidation';

export function isOnboardingFullNameValid(value: unknown): boolean {
  return isValidFullName(value);
}

export function isOnboardingWhatsappValid(value: unknown): boolean {
  const digits = normalizeOnboardingPhone(value);
  return digits.length >= 10 && digits.length <= 11;
}

export function getOnboardingContactValidation(input: {
  fullName?: unknown;
  whatsapp?: unknown;
}): {
  valid: boolean;
  fullName: boolean;
  whatsapp: boolean;
} {
  const fullName = isOnboardingFullNameValid(input.fullName);
  const whatsapp = isOnboardingWhatsappValid(input.whatsapp);

  return {
    valid: fullName && whatsapp,
    fullName,
    whatsapp,
  };
}