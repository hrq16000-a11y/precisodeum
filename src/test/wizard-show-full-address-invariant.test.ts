/**
 * Invariante de privacidade do Wizard:
 *   show_full_address NUNCA pode sair como `true` no payload final quando
 *   `street` e `street_number` estiverem vazios — independentemente do
 *   tipo de conta (PF/PJ) e do valor enviado pelo formulário.
 *
 * Também garante que o schema Zod (providerWritePayloadSchema) continua
 * aceitando `street` / `street_number` como opcionais para PF, sem street
 * obrigatório, sem postal_code obrigatório.
 */
import { describe, it, expect } from 'vitest';
import { normalizeProviderPayload } from '@/lib/providerPayload';
import { providerWritePayloadSchema, safeParse } from '@/lib/wizardSchemas';

const basePf = {
  user_id: '00000000-0000-0000-0000-000000000001',
  account_type: 'autonomous' as const,
  cpf: '12345678901',
  business_name: 'Fulano',
  legal_name: 'Fulano',
  whatsapp: '41999998888',
  city: 'Curitiba',
  state: 'PR',
};

const basePj = {
  user_id: '00000000-0000-0000-0000-000000000002',
  account_type: 'company' as const,
  cnpj: '11222333000181',
  business_name: 'Acme',
  legal_name: 'Acme LTDA',
  whatsapp: '41999998888',
  city: 'Curitiba',
  state: 'PR',
};

describe('show_full_address — invariante de privacidade', () => {
  describe('PF (autonomous)', () => {
    it('força show_full_address=false quando street e street_number estão vazios', () => {
      const out: any = normalizeProviderPayload({
        ...basePf,
        street: '',
        street_number: '',
        show_full_address: true,
      } as any);
      expect(out.show_full_address).toBe(false);
    });

    it('força show_full_address=false quando street/number são undefined', () => {
      const out: any = normalizeProviderPayload({
        ...basePf,
        show_full_address: true,
      } as any);
      expect(out.show_full_address).toBe(false);
    });

    it('força show_full_address=false quando street é só espaços', () => {
      const out: any = normalizeProviderPayload({
        ...basePf,
        street: '   ',
        street_number: '   ',
        show_full_address: true,
      } as any);
      expect(out.show_full_address).toBe(false);
    });

    it('preserva show_full_address=true quando há street preenchido', () => {
      const out: any = normalizeProviderPayload({
        ...basePf,
        street: 'Rua das Flores',
        street_number: '123',
        show_full_address: true,
      } as any);
      expect(out.show_full_address).toBe(true);
    });

    it('show_full_address=false sempre permanece false (qualquer combinação)', () => {
      const out: any = normalizeProviderPayload({
        ...basePf,
        street: 'Rua das Flores',
        street_number: '123',
        show_full_address: false,
      } as any);
      expect(out.show_full_address).toBe(false);
    });
  });

  describe('PJ (company)', () => {
    it('força show_full_address=false quando street/number vazios mesmo se enviado true', () => {
      const out: any = normalizeProviderPayload({
        ...basePj,
        street: '',
        street_number: '',
        show_full_address: true,
      } as any);
      expect(out.show_full_address).toBe(false);
    });

    it('preserva show_full_address=true quando logradouro preenchido', () => {
      const out: any = normalizeProviderPayload({
        ...basePj,
        street: 'Av. Brasil',
        street_number: '500',
        show_full_address: true,
      } as any);
      expect(out.show_full_address).toBe(true);
    });
  });
});

describe('providerWritePayloadSchema — street/street_number opcionais para PF', () => {
  it('aceita PF sem street/street_number/postal_code', () => {
    const r = safeParse(providerWritePayloadSchema, {
      ...basePf,
    });
    expect(r.ok).toBe(true);
  });

  it('aceita PF com street/street_number = null (após normalize)', () => {
    const r = safeParse(providerWritePayloadSchema, {
      ...basePf,
      street: null,
      street_number: null,
      complement: null,
      postal_code: null,
      show_full_address: false,
    });
    expect(r.ok).toBe(true);
  });

  it('aceita PF com endereço parcial (só street, sem number)', () => {
    const r = safeParse(providerWritePayloadSchema, {
      ...basePf,
      street: 'Rua das Flores',
    });
    expect(r.ok).toBe(true);
  });

  it('aceita PF com endereço completo + show_full_address=true', () => {
    const r = safeParse(providerWritePayloadSchema, {
      ...basePf,
      street: 'Rua das Flores',
      street_number: '123',
      complement: 'Sala 2',
      postal_code: '80000-000',
      show_full_address: true,
    });
    expect(r.ok).toBe(true);
  });

  it('aceita payload PF normalizado (com strings vazias convertidas a null)', () => {
    const normalized = normalizeProviderPayload({
      ...basePf,
      street: '',
      street_number: '',
      complement: '',
      postal_code: '',
      show_full_address: true, // será forçado a false pelo normalize
    } as any);
    const r = safeParse(providerWritePayloadSchema, normalized);
    expect(r.ok).toBe(true);
    expect((normalized as any).show_full_address).toBe(false);
  });
});
