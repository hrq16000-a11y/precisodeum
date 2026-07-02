/**
 * wizardSchemas — schemas Zod compartilhados pelo Wizard de cadastro.
 *
 * Centraliza tipos para falhar cedo e com mensagem clara ANTES de:
 *  - Chamar o backend (evita 400 silencioso).
 *  - Renderizar componentes que assumem shape válido.
 *
 * Não substitui RLS nem checks do banco — é a primeira camada (UX).
 */
import { z } from 'zod';

const trimmedString = (max: number) =>
  z.string().trim().max(max);

/** Valida payload mínimo de provider antes de bater no Supabase. */
export const providerWritePayloadSchema = z.object({
  user_id: z.string().uuid({ message: 'user_id inválido.' }),
  city: trimmedString(120).min(2, 'Informe a cidade.'),
  state: z
    .string()
    .trim()
    .length(2, 'UF deve ter 2 letras.')
    .regex(/^[A-Z]{2}$/, 'UF inválida.'),
  neighborhood: trimmedString(120).nullable().optional(),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'WhatsApp deve ter apenas dígitos (10–15).'),
  account_type: z.enum(['autonomous', 'company']),
  cpf: z.string().regex(/^\d{11}$/).nullable().optional(),
  cnpj: z.string().regex(/^\d{14}$/).nullable().optional(),
  business_name: trimmedString(160).nullable().optional(),
  legal_name: trimmedString(160).nullable().optional(),
  phone: trimmedString(20).nullable().optional(),
  description: trimmedString(2000).nullable().optional(),
  // Campos PJ opcionais — aceitar null porque normalizeProviderPayload converte
  // strings vazias em null via safeOptionalString.
  street: trimmedString(160).nullable().optional(),
  street_number: trimmedString(20).nullable().optional(),
  complement: trimmedString(120).nullable().optional(),
  postal_code: trimmedString(12).nullable().optional(),
  show_full_address: z.boolean().nullable().optional(),
}).passthrough(); // permite extras (social_links etc.) sem quebrar

export type ProviderWritePayload = z.infer<typeof providerWritePayloadSchema>;

/** Valida payload do bet draft remoto antes de hidratar o reducer. */
export const betDraftPayloadSchema = z.object({
  full_name: z.string().optional(),
  whatsapp: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  neighborhood: z.string().optional(),
  intent: z.enum(['client', 'professional', 'rh', 'sponsor']).nullable().optional(),
  pro_kind: z.enum(['pf', 'pj']).nullable().optional(),
  document: z.string().optional(),
  company_name: z.string().optional(),
  street: z.string().optional(),
  street_number: z.string().optional(),
  complement: z.string().optional(),
  postal_code: z.string().optional(),
  show_full_address: z.boolean().optional(),
  points: z.number().optional(),
  phase: z.string().optional(),
}).passthrough();

/**
 * Helper: retorna { ok: true, data } | { ok: false, message } sem lançar.
 * Use SEMPRE antes de chamadas ao Supabase no wizard.
 */
/**
 * Helper: retorna { ok: true, data } | { ok: false, message } sem lançar.
 * Use SEMPRE antes de chamadas ao Supabase no wizard.
 */
export type SafeParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; issues: z.ZodIssue[] };

export function safeParse<T>(schema: z.ZodType<T>, input: unknown): SafeParseResult<T> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  const path = first?.path.join('.') || 'campo';
  return { ok: false, message: `${path}: ${first?.message || 'inválido'}`, issues: r.error.issues };
}
