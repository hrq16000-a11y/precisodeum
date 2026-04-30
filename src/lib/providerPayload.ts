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
  'neighborhood',
  'phone',
  'whatsapp',
  'account_type',
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
 * Chaves de endereço detalhado que NÃO devem ser persistidas em `providers`.
 *
 * O schema só guarda `city`, `state`, `neighborhood`, `latitude`, `longitude`.
 * Qualquer tentativa de salvar logradouro/CEP/complemento vinda de UI antiga
 * ou de auto-fill é silenciosamente removida e logada em console.warn para
 * facilitar debugging. Isso impede 1) erros 42703 (column does not exist)
 * e 2) vazamento de PII de endereço residencial.
 */
/**
 * Keys de endereço que NÃO existem no schema da tabela `providers` para perfis
 * autônomos (PF). Para empresas (PJ, account_type='company'), as colunas
 * institucionais `street`, `street_number`, `complement`, `postal_code` foram
 * adicionadas via migration — então essas chaves devem ser preservadas.
 *
 * As chaves abaixo são SEMPRE removidas (aliases / colunas inexistentes).
 */
export const PROVIDER_FORBIDDEN_ADDRESS_KEYS = [
  'address',
  'logradouro',
  'cep',
  'zipcode',
  'zip',
  'complemento',
  'numero',
  'number',
  'address_line',
  'address_line_1',
  'address_line_2',
] as const;

/**
 * Chaves institucionais (endereço + identidade da empresa) que SÃO colunas
 * válidas em `providers`, mas só fazem sentido para perfis PJ. Para autônomos
 * são silenciosamente removidas.
 *
 * Inclui:
 *  - `show_full_address` — toggle de privacidade do endereço.
 *  - `business_segment`, `cnpj`, `business_name`, `legal_name` — identidade.
 *  - `street`, `street_number`, `complement`, `postal_code` — endereço.
 */
export const PROVIDER_PJ_ADDRESS_KEYS = [
  'street',
  'street_number',
  'complement',
  'postal_code',
  'show_full_address',
  'business_segment',
  'cnpj',
  'business_name',
  'legal_name',
] as const;

/** Subconjunto das chaves PJ que são strings opcionais (vs boolean). */
const PROVIDER_PJ_STRING_KEYS = new Set<string>([
  'street',
  'street_number',
  'complement',
  'postal_code',
  'business_segment',
  'cnpj',
  'business_name',
  'legal_name',
]);

/**
 * Normaliza um payload de provider antes do insert/update.
 *
 * - Garante que todos os campos em PROVIDER_REQUIRED_STRING_FIELDS sejam
 *   strings (vazias se faltarem).
 * - Remove silenciosamente chaves de endereço detalhado que não pertencem
 *   ao schema (logradouro/CEP/complemento). Loga aviso em dev.
 * - Mantém demais campos como vieram para preservar flexibilidade.
 *
 * @param input  Payload bruto montado pelo wizard / página de edição.
 * @returns      Payload pronto para `.insert()` ou `.update()`.
 */
export function normalizeProviderPayload<T extends RawProviderInput>(
  input: T,
): T & Record<ProviderRequiredStringField, string> {
  const out = { ...input } as Record<string, unknown>;
  const isCompany = (out.account_type as string) === 'company';

  // 1) Remove chaves proibidas (aliases / colunas inexistentes em qualquer caso).
  const stripped: string[] = [];
  for (const key of PROVIDER_FORBIDDEN_ADDRESS_KEYS) {
    if (key in out) {
      stripped.push(key);
      delete out[key];
    }
  }

  // 1b) Chaves institucionais — `business_name` e `legal_name` valem para
  //     PF e PJ (apenas saneadas). As demais (endereço, segmento, CNPJ,
  //     show_full_address) são removidas silenciosamente para PF.
  const PJ_ONLY_KEYS = new Set<string>([
    'street', 'street_number', 'complement', 'postal_code',
    'show_full_address', 'business_segment', 'cnpj',
  ]);

  if (!isCompany) {
    for (const key of PROVIDER_PJ_ADDRESS_KEYS) {
      if (PJ_ONLY_KEYS.has(key) && key in out) {
        stripped.push(key);
        delete out[key];
      } else if (key in out && PROVIDER_PJ_STRING_KEYS.has(key)) {
        // PF mantém business_name/legal_name, apenas saneia.
        out[key] = safeOptionalString(out[key]);
      }
    }
  } else {
    // PJ: sanitiza strings (trim + null em vazias). show_full_address
    //      permanece booleano — não passar por safeOptionalString.
    for (const key of PROVIDER_PJ_ADDRESS_KEYS) {
      if (!(key in out)) continue;
      if (PROVIDER_PJ_STRING_KEYS.has(key)) {
        out[key] = safeOptionalString(out[key]);
      } else if (key === 'show_full_address') {
        out[key] = out[key] === true;
      }
    }
  }

  if (stripped.length > 0 && typeof console !== 'undefined') {
    console.warn(
      '[providerPayload] Campos de endereço ignorados (não pertencem ao schema/perfil):',
      stripped.join(', '),
    );
  }

  // 2) Garante NOT NULL strings.
  for (const key of PROVIDER_REQUIRED_STRING_FIELDS) {
    out[key] = safeRequiredString(out[key]);
  }
  return out as T & Record<ProviderRequiredStringField, string>;
}

/**
 * Detecta payload com chaves de endereço inconsistentes (para mostrar aviso na UI).
 * Retorna lista de chaves problemáticas — vazio = OK.
 */
export function detectForbiddenAddressKeys(input: RawProviderInput): string[] {
  return PROVIDER_FORBIDDEN_ADDRESS_KEYS.filter((k) => k in input && Boolean(input[k]));
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
