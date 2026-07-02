/**
 * Regressão crítica: erro 23502 (null violates not-null) ao concluir wizard
 * com campos opcionais vazios (bio/whatsapp/cidade).
 *
 * Garante que `normalizeProviderPayload` sempre produza strings vazias para
 * as colunas NOT NULL DEFAULT '' da tabela `providers`, independentemente
 * de o consumidor passar null, undefined, espaços ou string vazia.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeProviderPayload,
  validateProviderCriticalFields,
  PROVIDER_REQUIRED_STRING_FIELDS,
  safeRequiredString,
  safeOptionalString,
} from '@/lib/providerPayload';

describe('normalizeProviderPayload — bloqueio de regressão 23502', () => {
  it('converte null/undefined para string vazia em todos os campos NOT NULL', () => {
    const out = normalizeProviderPayload({
      description: null,
      city: undefined,
      state: null,
      phone: undefined,
      whatsapp: null,
    } as any);
    for (const k of PROVIDER_REQUIRED_STRING_FIELDS) {
      expect(typeof out[k]).toBe('string');
      expect(out[k]).toBe('');
    }
  });

  it('cenário "bio vazia": pula passo da bio sem quebrar o insert', () => {
    const payload = normalizeProviderPayload({
      user_id: 'abc',
      slug: 'fulano-abc123',
      // Usuário pulou bio + localização — wizard envia tudo vazio
      description: '',
      city: '',
      state: '',
      whatsapp: '',
      phone: '',
      category_id: null,
      account_type: 'autonomous',
      status: 'pending',
    });
    // Nenhum dos campos críticos pode ser null/undefined no payload final
    PROVIDER_REQUIRED_STRING_FIELDS.forEach((k) => {
      expect(payload[k]).not.toBeNull();
      expect(payload[k]).not.toBeUndefined();
      expect(payload[k]).toBe(k === 'account_type' ? 'autonomous' : '');
    });
    // Campos opcionais permanecem como informados
    expect(payload.category_id).toBeNull();
    expect(payload.user_id).toBe('abc');
    expect(payload.status).toBe('pending');
  });

  it('faz trim e mantém valores válidos', () => {
    const out = normalizeProviderPayload({
      description: '  Eletricista experiente  ',
      city: 'Curitiba',
      state: 'PR',
      whatsapp: '41999998888',
      phone: '4133334444',
    });
    expect(out.description).toBe('Eletricista experiente');
    expect(out.city).toBe('Curitiba');
    expect(out.whatsapp).toBe('41999998888');
  });

  it('aceita payload sem nenhum dos campos obrigatórios e os adiciona', () => {
    const out = normalizeProviderPayload({ user_id: 'x' } as any);
    PROVIDER_REQUIRED_STRING_FIELDS.forEach((k) => expect(out[k]).toBe(''));
  });
});

describe('safeRequiredString / safeOptionalString', () => {
  it('safeRequiredString: nunca retorna null', () => {
    expect(safeRequiredString(null)).toBe('');
    expect(safeRequiredString(undefined)).toBe('');
    expect(safeRequiredString(123 as any)).toBe('');
    expect(safeRequiredString('  ok  ')).toBe('ok');
  });

  it('safeOptionalString: vazio vira null, valor preserva trim', () => {
    expect(safeOptionalString('')).toBeNull();
    expect(safeOptionalString('   ')).toBeNull();
    expect(safeOptionalString(null)).toBeNull();
    expect(safeOptionalString(' Curitiba ')).toBe('Curitiba');
  });
});

describe('validateProviderCriticalFields — bloqueia skip de campos críticos', () => {
  it('exige nome completo (>= 2 chars)', () => {
    expect(validateProviderCriticalFields({ full_name: '', whatsapp: '41999998888' }))
      .toContain('missing_full_name');
    expect(validateProviderCriticalFields({ full_name: 'A', whatsapp: '41999998888' }))
      .toContain('missing_full_name');
  });

  it('exige WhatsApp com >= 10 dígitos', () => {
    expect(validateProviderCriticalFields({ full_name: 'Fulano Silva', whatsapp: '999' }))
      .toContain('missing_whatsapp');
    expect(validateProviderCriticalFields({ full_name: 'Fulano Silva', whatsapp: '' }))
      .toContain('missing_whatsapp');
  });

  it('passa quando os dois campos críticos estão preenchidos', () => {
    const issues = validateProviderCriticalFields({
      full_name: 'Fulano Silva',
      whatsapp: '(41) 99999-8888',
    });
    expect(issues).toHaveLength(0);
  });
});
