import { describe, it, expect } from 'vitest';
import { providerWritePayloadSchema, safeParse } from '@/lib/wizardSchemas';
import { normalizeProviderPayload } from '@/lib/providerPayload';

describe('schema validation', () => {
  it('accepts PJ payload with empty optional fields (becomes null after normalize)', () => {
    const payload = normalizeProviderPayload({
      user_id: '00000000-0000-0000-0000-000000000001',
      account_type: 'company',
      business_name: 'Acme',
      legal_name: 'Acme',
      cpf: null,
      cnpj: null,
      whatsapp: '41999999999',
      phone: '41999999999',
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Italia',
      description: '',
      street: '',
      street_number: '',
      complement: '',
      postal_code: '',
      show_full_address: false,
    });
    const r = safeParse(providerWritePayloadSchema, payload);
    if (!r.ok) console.log('FAIL:', r.message, r.issues);
    expect(r.ok).toBe(true);
  });

  it('accepts PF payload', () => {
    const payload = normalizeProviderPayload({
      user_id: '00000000-0000-0000-0000-000000000002',
      account_type: 'autonomous',
      business_name: 'Matteus',
      legal_name: 'Matteus',
      cpf: null,
      cnpj: null,
      whatsapp: '41999999999',
      phone: '41999999999',
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Italia',
      description: '',
    });
    const r = safeParse(providerWritePayloadSchema, payload);
    if (!r.ok) console.log('FAIL:', r.message, r.issues);
    expect(r.ok).toBe(true);
  });
});
