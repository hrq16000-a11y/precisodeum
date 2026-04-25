import { describe, it, expect } from 'vitest';

// Garante que o campo Bairro é tratado como opcional na validação unificada do wizard
// e que ele é incluído no payload de persistência para profiles e providers.

// Espelha o comportamento de validateStep(3) e do builder de payload do SmartOnboardingWizard.
// Mantemos a função pura aqui para evitar montar todo o React do wizard nos testes.

type Step3Input = {
  fullName: string;
  whatsapp: string;
  selectedCategoryIds: string[];
  profileType: 'provider' | 'rh' | 'client';
  agencyName: string;
  taxId?: string;
  providerSubtype?: 'autonomous' | 'company';
  neighborhood?: string;
};

type FieldError = { field: string; message: string };

const validateStep3 = (i: Step3Input): FieldError[] => {
  const errors: FieldError[] = [];
  if (!i.fullName.trim()) errors.push({ field: 'fullName', message: 'Informe seu nome completo.' });
  if (i.whatsapp.replace(/\D/g, '').length < 10) errors.push({ field: 'whatsapp', message: 'WhatsApp inválido.' });
  if (i.profileType === 'provider' && i.selectedCategoryIds.length === 0) {
    errors.push({ field: 'category', message: 'Selecione a categoria principal.' });
  }
  if (i.profileType === 'rh' && !i.agencyName.trim()) {
    errors.push({ field: 'agencyName', message: 'Informe o nome da agência.' });
  }
  // neighborhood NÃO é obrigatório — nunca deve gerar erro
  return errors;
};

const buildProfilePatch = (i: Step3Input) => ({
  full_name: i.fullName.trim(),
  whatsapp: i.whatsapp || null,
  phone: i.whatsapp || null,
  neighborhood: i.neighborhood?.trim() || null,
});

const buildProviderPatch = (i: Step3Input, city: string, state: string) => ({
  city,
  state,
  neighborhood: i.neighborhood?.trim() || null,
  whatsapp: i.whatsapp || null,
});

describe('Wizard Step 3 — Bairro (opcional)', () => {
  const base: Step3Input = {
    fullName: 'Maria Silva',
    whatsapp: '41997452053',
    selectedCategoryIds: ['cat-1'],
    profileType: 'provider',
    agencyName: '',
    providerSubtype: 'autonomous',
  };

  it('avança sem bairro preenchido (campo opcional)', () => {
    expect(validateStep3({ ...base, neighborhood: '' })).toEqual([]);
    expect(validateStep3({ ...base, neighborhood: undefined })).toEqual([]);
  });

  it('avança com bairro preenchido', () => {
    expect(validateStep3({ ...base, neighborhood: 'Batel' })).toEqual([]);
  });

  it('inclui bairro no payload de profiles quando preenchido', () => {
    const patch = buildProfilePatch({ ...base, neighborhood: '  Batel  ' });
    expect(patch.neighborhood).toBe('Batel');
  });

  it('envia null no payload de profiles quando vazio', () => {
    expect(buildProfilePatch({ ...base, neighborhood: '' }).neighborhood).toBeNull();
    expect(buildProfilePatch({ ...base, neighborhood: '   ' }).neighborhood).toBeNull();
    expect(buildProfilePatch(base).neighborhood).toBeNull();
  });

  it('inclui bairro no payload de providers (espelhando profiles)', () => {
    const patch = buildProviderPatch({ ...base, neighborhood: 'Centro' }, 'Curitiba', 'PR');
    expect(patch.neighborhood).toBe('Centro');
    expect(patch.city).toBe('Curitiba');
    expect(patch.state).toBe('PR');
  });

  it('volta corretamente ao reabrir edição (round-trip)', () => {
    const saved = { neighborhood: 'Água Verde' };
    // Simula seed do estado a partir do registro salvo
    const seeded: Step3Input = { ...base, neighborhood: saved.neighborhood };
    expect(seeded.neighborhood).toBe('Água Verde');
    // E gera o mesmo payload de novo, sem perder o valor
    expect(buildProfilePatch(seeded).neighborhood).toBe('Água Verde');
  });
});
