/**
 * Phase 2.4 — Sponsor Self-Service helpers.
 * Whitelist espelhada server-side (RPC sponsor_submit_change_request).
 * Mantenha em sync com a migration `sponsor_change_requests`.
 */
import { z } from 'zod';

export const SELF_SERVICE_FIELDS = [
  'image_url',
  'logo_url',
  'link_url',
  'external_link',
  'phone',
  'whatsapp',
  'short_description',
  'full_description',
  'linked_city',
  'linked_category',
  'renewal_requested',
] as const;

export type SelfServiceField = (typeof SELF_SERVICE_FIELDS)[number];

export const SENSITIVE_FIELDS = new Set<SelfServiceField>([
  'linked_city',
  'linked_category',
]);

export const FIELD_LABELS: Record<SelfServiceField, string> = {
  image_url: 'Banner',
  logo_url: 'Logo',
  link_url: 'Link do CTA',
  external_link: 'Site/Link externo',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  short_description: 'Descrição curta',
  full_description: 'Descrição completa',
  linked_city: 'Cidade vinculada',
  linked_category: 'Categoria vinculada',
  renewal_requested: 'Renovação solicitada',
};

export const changeRequestSchema = z
  .object({
    image_url: z.string().url('URL inválida').max(2000).optional(),
    logo_url: z.string().url('URL inválida').max(2000).optional(),
    link_url: z.string().url('URL inválida').max(2000).optional(),
    external_link: z.string().url('URL inválida').max(2000).optional(),
    phone: z
      .string()
      .trim()
      .min(8, 'Telefone muito curto')
      .max(20, 'Telefone muito longo')
      .optional(),
    whatsapp: z
      .string()
      .trim()
      .min(8, 'WhatsApp muito curto')
      .max(20, 'WhatsApp muito longo')
      .optional(),
    short_description: z.string().trim().min(10).max(160).optional(),
    full_description: z.string().trim().min(20).max(1200).optional(),
    linked_city: z.string().trim().min(2).max(120).optional(),
    linked_category: z.string().trim().min(2).max(120).optional(),
    renewal_requested: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Nenhuma alteração informada',
  });

export type ChangeRequestPayload = z.infer<typeof changeRequestSchema>;

/** Remove campos vazios/iguais ao snapshot para evitar requests no-op. */
export function diffChanges(
  payload: Record<string, unknown>,
  snapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    const v = payload[key];
    if (v === undefined || v === '' || v === null) continue;
    const s = snapshot?.[key];
    if (typeof v === 'string' && typeof s === 'string' && v.trim() === s.trim()) continue;
    if (v === s) continue;
    out[key] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ChangeRequestRow {
  id: string;
  sponsor_id: string;
  requested_by: string;
  status: ChangeRequestStatus;
  changes: Record<string, unknown>;
  current_snapshot: Record<string, unknown>;
  storage_paths: string[] | null;
  admin_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
