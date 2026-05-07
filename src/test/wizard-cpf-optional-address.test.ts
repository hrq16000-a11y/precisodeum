/**
 * Wizard CPF (PF) — endereço opcional + show_full_address.
 *
 * Cobre:
 *  1. PhaseProDocument renderiza o bloco "Adicionar endereço (Opcional)" para PF.
 *  2. CompanyAddressForm aceita prop accountKind e tem microcopy específica para PF
 *     (diferenciando "endereço completo" vs "apenas bairro/cidade").
 *  3. BetModeShell só envia show_full_address=true quando há logradouro preenchido
 *     (PF e PJ) — evita flag órfã sem endereço.
 *  4. providerWritePayloadSchema aceita street/street_number/postal_code/show_full_address
 *     como opcionais (nullable) para PF.
 *  5. normalizeProviderPayload (PF, autonomous) preserva street/street_number/complement
 *     quando preenchidos, mas remove show_full_address quando enviado sem logradouro.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { providerWritePayloadSchema, safeParse } from '@/lib/wizardSchemas';
import { normalizeProviderPayload } from '@/lib/providerPayload';

const PHASE_DOC = readFileSync(
  resolve(__dirname, '../components/onboarding/wizard/phases/bet/PhaseProDocument.tsx'),
  'utf8',
);
const COMPANY_FORM = readFileSync(
  resolve(__dirname, '../components/company/CompanyAddressForm.tsx'),
  'utf8',
);
const SHELL = readFileSync(
  resolve(__dirname, '../components/onboarding/wizard/phases/bet/BetModeShell.tsx'),
  'utf8',
);

describe('Wizard CPF — endereço opcional + show_full_address', () => {
  it('PhaseProDocument expõe o bloco para PF (texto específico)', () => {
    expect(PHASE_DOC).toMatch(/Atende em endereço fixo/);
    expect(PHASE_DOC).toMatch(/estúdio, consultório, residência/);
    expect(PHASE_DOC).toMatch(/accountKind={isPf \? 'pf' : 'pj'}/);
  });

  it('CompanyAddressForm tem microcopy específica para PF (aparecer online vs bairro/cidade)', () => {
    expect(COMPANY_FORM).toMatch(/accountKind\?: 'pf' \| 'pj'/);
    expect(COMPANY_FORM).toMatch(/aparecer online/i);
    // Não removeu o caso PJ
    expect(COMPANY_FORM).toMatch(/Ponto de atendimento físico em/);
  });

  it('BetModeShell só envia show_full_address=true quando há logradouro (PF e PJ)', () => {
    // Procura o bloco condicional do payload — deve checar street antes de show_full_address=true
    expect(SHELL).toMatch(/state\.street && state\.street\.trim\(\)\.length > 0/);
    expect(SHELL).toMatch(/show_full_address: state\.show_full_address === true/);
    // Comentário documentando a regra
    expect(SHELL).toMatch(/show_full_address só faz sentido quando há endereço preenchido/);
  });

  it('providerWritePayloadSchema aceita PF com endereço opcional (sem street)', () => {
    const result = safeParse(providerWritePayloadSchema, {
      user_id: '00000000-0000-0000-0000-000000000001',
      city: 'Curitiba',
      state: 'PR',
      whatsapp: '41999998888',
      account_type: 'autonomous',
      cpf: '12345678901',
      business_name: 'Fulano',
      legal_name: 'Fulano',
      // sem street/show_full_address
    });
    expect(result.ok).toBe(true);
  });

  it('providerWritePayloadSchema aceita PF com endereço completo + show_full_address=true', () => {
    const result = safeParse(providerWritePayloadSchema, {
      user_id: '00000000-0000-0000-0000-000000000001',
      city: 'Curitiba',
      state: 'PR',
      whatsapp: '41999998888',
      account_type: 'autonomous',
      cpf: '12345678901',
      business_name: 'Fulano',
      legal_name: 'Fulano',
      street: 'Rua das Flores',
      street_number: '123',
      complement: 'Sala 2',
      postal_code: '80000-000',
      show_full_address: true,
    });
    expect(result.ok).toBe(true);
  });

  it('normalizeProviderPayload (PF) preserva street/number quando preenchidos', () => {
    const out = normalizeProviderPayload({
      user_id: 'u1',
      city: 'Curitiba',
      state: 'PR',
      whatsapp: '41999998888',
      account_type: 'autonomous',
      cpf: '12345678901',
      business_name: 'Fulano',
      legal_name: 'Fulano',
      street: 'Rua das Flores',
      street_number: '123',
      complement: 'Sala 2',
    } as any) as any;
    expect(out.street).toBe('Rua das Flores');
    expect(out.street_number).toBe('123');
    expect(out.complement).toBe('Sala 2');
  });

  it('normalizeProviderPayload (PF) remove show_full_address (chave PJ-only)', () => {
    const out = normalizeProviderPayload({
      user_id: 'u1',
      city: 'Curitiba',
      state: 'PR',
      whatsapp: '41999998888',
      account_type: 'autonomous',
      cpf: '12345678901',
      business_name: 'Fulano',
      legal_name: 'Fulano',
      show_full_address: true,
    } as any) as any;
    expect(out.show_full_address).toBeUndefined();
  });
});
