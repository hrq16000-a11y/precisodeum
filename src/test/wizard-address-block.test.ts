/**
 * Garantias do Wizard sobre endereço:
 *  1. normalizeProviderPayload remove SEMPRE logradouro/cep/complemento.
 *  2. detectForbiddenAddressKeys só dispara quando há valor real (não-vazio).
 *  3. Payload limpo (apenas city/state/neighborhood) NÃO acende warning.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeProviderPayload,
  detectForbiddenAddressKeys,
  PROVIDER_FORBIDDEN_ADDRESS_KEYS,
} from '@/lib/providerPayload';

describe('Wizard — bloqueio de campos de endereço opcionais', () => {
  it('normalize remove TODAS as chaves proibidas, mesmo se vierem por engano', () => {
    const dirty: Record<string, unknown> = {
      user_id: 'u1',
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
    };
    PROVIDER_FORBIDDEN_ADDRESS_KEYS.forEach((k) => { dirty[k] = 'algum valor'; });

    const cleaned = normalizeProviderPayload(dirty);
    PROVIDER_FORBIDDEN_ADDRESS_KEYS.forEach((k) => {
      expect(cleaned).not.toHaveProperty(k);
    });
    // Mantém os campos válidos
    expect(cleaned.city).toBe('Curitiba');
    expect(cleaned.state).toBe('PR');
    expect(cleaned.neighborhood).toBe('Batel');
  });

  it('payload limpo NÃO dispara aviso (sem inconsistência real)', () => {
    const ok = {
      user_id: 'u1', city: 'Curitiba', state: 'PR', neighborhood: 'Batel',
      whatsapp: '41999998888', phone: '', description: 'Eletricista',
    };
    expect(detectForbiddenAddressKeys(ok)).toEqual([]);
  });

  it('chaves proibidas vazias/undefined NÃO disparam aviso (evita falso-positivo)', () => {
    const empties = {
      user_id: 'u1', city: 'Curitiba', state: 'PR',
      cep: '', logradouro: undefined, complemento: null,
      number: '', address: '   ',
    };
    // Strings vazias e null/undefined são considerados "sem valor"
    const found = detectForbiddenAddressKeys(empties as any);
    // Apenas '   ' é truthy (string com espaços) → mesmo assim só esse vem
    expect(found.every((k) => k !== 'cep' && k !== 'logradouro' && k !== 'complemento' && k !== 'number')).toBe(true);
  });

  it('chave proibida com valor real DISPARA aviso (consistência)', () => {
    const inconsistent = {
      user_id: 'u1', city: 'Curitiba', state: 'PR',
      cep: '80000-000', logradouro: 'Rua das Flores 123',
    };
    const found = detectForbiddenAddressKeys(inconsistent);
    expect(found).toContain('cep');
    expect(found).toContain('logradouro');
  });

  it('payload sanitizado pelo normalize não dispara aviso depois', () => {
    const dirty = { user_id: 'u1', city: 'Curitiba', state: 'PR', cep: '80000-000' };
    const cleaned = normalizeProviderPayload(dirty);
    expect(detectForbiddenAddressKeys(cleaned)).toEqual([]);
  });
});
