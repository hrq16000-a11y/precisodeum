/**
 * Phone normalization (Fase 1.3) — fonte única para NOVOS saves.
 *
 * Padrão oficial: somente dígitos com prefixo 55 (5521999999999).
 * Brasil apenas. Delega à infra existente em `src/lib/whatsapp.ts`
 * para não duplicar regras de canonical/validate/display.
 *
 * Dados antigos continuam sendo lidos sem normalização forçada.
 * Apenas novos saves devem chamar este helper.
 */

import {
  toCanonical,
  isValidWhatsApp,
  formatPhoneDisplay,
  validateWhatsapp as legacyValidate,
  sanitizePhone,
} from '@/lib/whatsapp';

export const PHONE_INVALID_MESSAGE = 'Digite um WhatsApp válido com DDD.';

/**
 * Normaliza qualquer entrada para `55DDDNUMBER` (12 ou 13 dígitos).
 * Retorna string vazia se a entrada não puder ser normalizada.
 */
export function normalizePhoneBR(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return toCanonical(raw);
}

/**
 * Valida um telefone BR (raw ou canônico). Aceita 10–13 dígitos.
 * Rejeita letras, formatos absurdos, números repetitivos (000000).
 */
export function isValidPhoneBR(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const digits = sanitizePhone(raw);
  if (!digits) return false;
  if (!isValidWhatsApp(digits)) return false;
  // Rejeita sequências repetitivas óbvias (000000..., 111111...)
  if (/^(\d)\1+$/.test(digits)) return false;
  // Reusa validação detalhada (checa DDD válido)
  return legacyValidate(raw).valid;
}

/** Formata para exibição: `(21) 99999-9999`. */
export function toDisplayPhoneBR(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  return formatPhoneDisplay(value);
}

/** Só dispara validação quando o valor mudou (preserva legado). */
export function shouldEnforcePhone(next: unknown, previous: unknown): boolean {
  const a = normalizePhoneBR(next);
  const b = normalizePhoneBR(previous);
  if (!a && !b) {
    // Mantém compat: se ambos vazios após normalização, não força
    const aRaw = typeof next === 'string' ? next.trim() : '';
    const bRaw = typeof previous === 'string' ? previous.trim() : '';
    return aRaw !== bRaw && aRaw.length > 0;
  }
  return a !== b;
}
