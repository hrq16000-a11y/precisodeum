export function normalizeOnboardingPhone(value: unknown): string {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return digits.replace(/^55(?=\d{10,11}$)/, '');
}

export function isOnboardingFullNameValid(value: unknown): boolean {
  const trimmed = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (trimmed.length < 4) return false;
  const parts = trimmed.split(' ').filter(Boolean);
  return parts.length >= 2;
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