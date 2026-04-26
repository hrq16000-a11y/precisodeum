/**
 * Normalização única de payload da tabela `providers`.
 *
 * Motivação:
 *   As colunas description/city/state/phone/whatsapp são NOT NULL com
 *   DEFAULT ''. Enviar `null` ou `undefined` causa erro 23502
 *   (null value violates not-null constraint), abortando o cadastro.
 *
 * Esta função é a fonte única de verdade — usada tanto pelo
 * SmartOnboardingWizard quanto pelo DashboardProfilePage para garantir
 * consistência entre criação (insert) e edição (update).
 *
 * Regras:
 *  - Campos NOT NULL com default ''  → sempre string (vazia se ausente).
 *  - Campos opcionais nullable       → preserva null quando vazio.
 *  - Strings recebidas são `.trim()` para evitar espaços fantasmas.
 */

/** Colunas obrigatórias em `providers` que NUNCA podem ser null. */
export const PROVIDER_REQUIRED_STRING_FIELDS = [
  'description',
  'city',
  'state',
  'phone',
  'whatsapp',
] as const;

export type ProviderRequiredStringField =
  (typeof PROVIDER_REQUIRED_STRING_FIELDS)[number];

/** Sanitiza string: coalesce para '' e trim. */
export function safeRequiredString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/** Sanitiza opcional: '' / espaços → null. */
export function safeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

export type RawProviderInput = Record<string, unknown>;

/**
 * Normaliza um payload de provider antes do insert/update.
 *
 * - Garante que todos os campos em PROVIDER_REQUIRED_STRING_FIELDS sejam
 *   strings (vazias se faltarem).
 * - Mantém demais campos como vieram (não filtra colunas desconhecidas
 *   para preservar flexibilidade do chamador).
 *
 * @param input  Payload bruto montado pelo wizard / página de edição.
 * @returns      Payload pronto para `.insert()` ou `.update()`.
 */
export function normalizeProviderPayload<T extends RawProviderInput>(
  input: T,
): T & Record<ProviderRequiredStringField, string> {
  const out = { ...input } as Record<string, unknown>;
  for (const key of PROVIDER_REQUIRED_STRING_FIELDS) {
    out[key] = safeRequiredString(out[key]);
  }
  return out as T & Record<ProviderRequiredStringField, string>;
}

/** Validação mínima para impedir submissão de cadastro inviável. */
export type ProviderValidationIssue =
  | 'missing_full_name'
  | 'missing_whatsapp';

export function validateProviderCriticalFields(input: {
  full_name?: string | null;
  whatsapp?: string | null;
}): ProviderValidationIssue[] {
  const issues: ProviderValidationIssue[] = [];
  if (!input.full_name || input.full_name.trim().length < 2) {
    issues.push('missing_full_name');
  }
  // whatsapp: precisamos de ao menos 10 dígitos (DDD + número)
  const digits = (input.whatsapp ?? '').replace(/\D/g, '');
  if (digits.length < 10) issues.push('missing_whatsapp');
  return issues;
}

export const PROVIDER_VALIDATION_MESSAGES: Record<ProviderValidationIssue, string> = {
  missing_full_name: 'Informe seu nome completo antes de continuar.',
  missing_whatsapp: 'WhatsApp válido é obrigatório (com DDD).',
};
