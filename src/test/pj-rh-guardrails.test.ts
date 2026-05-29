/**
 * Guardrails: o módulo PJ NÃO pode afetar o fluxo RH (profile_type='rh').
 *
 * Validações:
 *  1. normalizeProviderPayload nunca aplica chaves PJ-only quando o
 *     account_type não é 'company'. RH não usa providers, mas se algum
 *     payload mal-formado vazar, ele deve ser limpo silenciosamente.
 *  2. CompanyAddressForm é um componente isolado e não importa nada
 *     de agencies/RH.
 *  3. PROVIDER_PJ_ADDRESS_KEYS contém todas as chaves institucionais
 *     esperadas (anti-regressão de schema).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  normalizeProviderPayload,
  PROVIDER_PJ_ADDRESS_KEYS,
} from '@/lib/providerPayload';

describe('PJ × RH guardrails', () => {
  it('strips PJ-only keys when account_type is autonomous (PF)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = normalizeProviderPayload({
      account_type: 'autonomous',
      city: 'Recife',
      state: 'PE',
      neighborhood: 'Boa Viagem',
      phone: '81999999999',
      whatsapp: '81999999999',
      description: 'x',
      // PJ-only (strictly): segment / cnpj / social_links — SEMPRE removidas em PF
      business_segment: 'tecnologia',
      cnpj: '00000000000000',
      social_links: { instagram: 'foo' },
      // Endereço institucional: PRESERVADO em PF (cpf-optional contract)
      street: 'Rua A',
      street_number: '10',
      complement: 'sala 1',
      postal_code: '50000-000',
      show_full_address: true,
    });
    // PJ-only strictly removidas:
    expect((out as any).business_segment).toBeUndefined();
    expect((out as any).cnpj).toBeUndefined();
    expect((out as any).social_links).toBeUndefined();
    // Endereço preservado (autônomo com estúdio/consultório/residência):
    expect((out as any).street).toBe('Rua A');
    expect((out as any).street_number).toBe('10');
    expect((out as any).postal_code).toBe('50000-000');
    // show_full_address agora é coluna válida em PF (invariante de privacidade
    // alinhado a wizard-show-full-address-invariant): preservado como boolean
    // com street presente → true.
    expect((out as any).show_full_address).toBe(true);

    warn.mockRestore();
  });

  it('keeps PJ keys when account_type is company and converts empty strings to null', () => {
    const out = normalizeProviderPayload({
      account_type: 'company',
      city: 'Recife',
      state: 'PE',
      neighborhood: 'Centro',
      phone: '8133333333',
      whatsapp: '8199999999',
      description: 'x',
      business_name: '  Empresa X  ',
      legal_name: '',
      business_segment: '   ',
      cnpj: '00.000.000/0000-00',
      street: 'Av. B',
      street_number: '',
      complement: '',
      postal_code: '50000-000',
      show_full_address: true,
      social_links: { instagram: '   ', site: 'https://x.com' },
    });
    expect((out as any).business_name).toBe('Empresa X');
    expect((out as any).legal_name).toBeNull();
    expect((out as any).business_segment).toBeNull();
    expect((out as any).street_number).toBeNull();
    expect((out as any).complement).toBeNull();
    expect((out as any).show_full_address).toBe(true);
    expect((out as any).social_links).toEqual({ site: 'https://x.com' });
  });

  it('PROVIDER_PJ_ADDRESS_KEYS contains all expected institutional keys', () => {
    const expected = [
      'street', 'street_number', 'complement', 'postal_code',
      'show_full_address', 'business_segment', 'cnpj',
      'business_name', 'legal_name', 'social_links',
    ];
    for (const k of expected) {
      expect(PROVIDER_PJ_ADDRESS_KEYS).toContain(k as any);
    }
  });

  it('CompanyAddressForm does not import anything from agency/RH modules', () => {
    const path = resolve(__dirname, '../components/company/CompanyAddressForm.tsx');
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, 'utf8');
    expect(src).not.toMatch(/\bagencies\b/i);
    expect(src).not.toMatch(/\bagency\b/i);
    expect(src).not.toMatch(/AgencyData|DashboardAgency|recruit/i);
  });

  it('DashboardCompanyDataPage guards against non-provider profile types', () => {
    const path = resolve(__dirname, '../pages/DashboardCompanyDataPage.tsx');
    const src = readFileSync(path, 'utf8');
    // Deve checar profile_type !== 'provider' e redirecionar.
    expect(src).toMatch(/profile_type\s*!==\s*['"]provider['"]/);
    expect(src).toMatch(/navigate\(['"]\/dashboard['"]/);
  });

  it('DashboardCompanyDataPage does not touch the agencies table', () => {
    const path = resolve(__dirname, '../pages/DashboardCompanyDataPage.tsx');
    const src = readFileSync(path, 'utf8');
    expect(src).not.toMatch(/from\(['"]agencies['"]\)/);
  });
});
