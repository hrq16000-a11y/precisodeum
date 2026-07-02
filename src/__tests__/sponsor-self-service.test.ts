/**
 * Phase 2.4 — Sponsor self-service unit tests.
 * Cobre whitelist client-side, schema zod e diff de payload.
 * As checagens server-side (ownership, rate-limit, pending-lock)
 * são garantidas pela RPC `sponsor_submit_change_request` na migration.
 */
import { describe, it, expect } from 'vitest';
import {
  SELF_SERVICE_FIELDS,
  SENSITIVE_FIELDS,
  changeRequestSchema,
  diffChanges,
} from '@/lib/sponsorSelfService';

describe('SELF_SERVICE_FIELDS whitelist', () => {
  it('inclui apenas campos editáveis seguros', () => {
    expect(SELF_SERVICE_FIELDS).toContain('image_url');
    expect(SELF_SERVICE_FIELDS).toContain('whatsapp');
    expect(SELF_SERVICE_FIELDS).toContain('renewal_requested');
  });

  it('NÃO inclui campos sensíveis de billing/inventory', () => {
    const forbidden = ['tier', 'position', 'display_order', 'active', 'plan_tier', 'plan', 'status'];
    for (const f of forbidden) {
      expect(SELF_SERVICE_FIELDS as readonly string[]).not.toContain(f);
    }
  });

  it('marca cidade/categoria como sensíveis (revisão obrigatória)', () => {
    expect(SENSITIVE_FIELDS.has('linked_city')).toBe(true);
    expect(SENSITIVE_FIELDS.has('linked_category')).toBe(true);
  });
});

describe('changeRequestSchema', () => {
  it('rejeita payload vazio', () => {
    const r = changeRequestSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('rejeita URL inválida em link_url', () => {
    const r = changeRequestSchema.safeParse({ link_url: 'not-a-url' });
    expect(r.success).toBe(false);
  });

  it('aceita payload mínimo válido', () => {
    const r = changeRequestSchema.safeParse({ phone: '11999998888' });
    expect(r.success).toBe(true);
  });

  it('limita short_description a 160 chars', () => {
    const r = changeRequestSchema.safeParse({ short_description: 'a'.repeat(200) });
    expect(r.success).toBe(false);
  });
});

describe('diffChanges', () => {
  it('remove campos iguais ao snapshot', () => {
    const out = diffChanges({ phone: '11999998888' }, { phone: '11999998888' });
    expect(out).toEqual({});
  });

  it('mantém campos alterados (trim aplicado)', () => {
    const out = diffChanges({ phone: ' 11000000000 ' }, { phone: '11999998888' });
    expect(out).toEqual({ phone: '11000000000' });
  });

  it('ignora strings vazias', () => {
    const out = diffChanges({ phone: '', whatsapp: '11888887777' }, { phone: '11999998888' });
    expect(out).toEqual({ whatsapp: '11888887777' });
  });

  it('aceita boolean renewal_requested', () => {
    const out = diffChanges({ renewal_requested: true }, {});
    expect(out).toEqual({ renewal_requested: true });
  });
});
