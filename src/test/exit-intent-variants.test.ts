import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSessionVariant,
  phaseGroup,
  resolveExitIntentCopy,
  setSessionVariantForTest,
} from '@/lib/exitIntentVariants';

describe('exitIntentVariants — phaseGroup', () => {
  it('mapeia fases triagem corretamente', () => {
    expect(phaseGroup('triage_identity')).toBe('triage');
    expect(phaseGroup('triage_celebration')).toBe('triage');
  });
  it('mapeia fases main e extras', () => {
    expect(phaseGroup('main_service')).toBe('main');
    expect(phaseGroup('main_more_services')).toBe('extras');
    expect(phaseGroup('main_portfolio_albums')).toBe('extras');
    expect(phaseGroup('phase2_service')).toBe('main');
  });
  it('cai no fallback "other" para fases desconhecidas', () => {
    expect(phaseGroup('algo_estranho')).toBe('other');
  });
});

describe('exitIntentVariants — getSessionVariant', () => {
  beforeEach(() => setSessionVariantForTest(null));

  it('retorna A ou B e persiste a escolha', () => {
    const v1 = getSessionVariant();
    expect(['A', 'B']).toContain(v1);
    const v2 = getSessionVariant();
    expect(v2).toBe(v1);
  });

  it('respeita variante já gravada', () => {
    setSessionVariantForTest('B');
    expect(getSessionVariant()).toBe('B');
    setSessionVariantForTest('A');
    expect(getSessionVariant()).toBe('A');
  });
});

describe('exitIntentVariants — resolveExitIntentCopy', () => {
  it('cliente recebe copy de busca, não de cadastro', () => {
    const copy = resolveExitIntentCopy('A', { phase: 'triage_identity', intent: 'client' });
    expect(copy.title.toLowerCase()).toMatch(/profissional|encontrar|indica/);
    expect(copy.body).not.toMatch(/perfil/i);
  });

  it('profissional na triagem foca em finalizar cadastro', () => {
    const copy = resolveExitIntentCopy('A', { phase: 'triage_identity', intent: 'professional' });
    expect(copy.body.toLowerCase()).toMatch(/cadastro|perfil|aparecer/);
  });

  it('profissional na main foca em publicar serviço', () => {
    const copy = resolveExitIntentCopy('A', { phase: 'main_service', intent: 'professional' });
    expect(copy.body.toLowerCase()).toMatch(/serviço|publicar|cliente/);
  });

  it('profissional em extras foca em portfólio/mais serviços', () => {
    const copy = resolveExitIntentCopy('A', {
      phase: 'main_portfolio_albums',
      intent: 'professional',
    });
    expect(copy.body.toLowerCase()).toMatch(/portfólio|serviços|perfil/);
  });

  it('variantes A e B produzem copy diferente para mesma combinação', () => {
    const a = resolveExitIntentCopy('A', { phase: 'triage_identity', intent: 'professional' });
    const b = resolveExitIntentCopy('B', { phase: 'triage_identity', intent: 'professional' });
    expect(a.title).not.toBe(b.title);
    expect(a.whatsappMessage).not.toBe(b.whatsappMessage);
  });

  it('whatsappUrl sempre aponta para wa.me/5541997452053', () => {
    const c = resolveExitIntentCopy('A', { phase: 'main_service', intent: 'professional' });
    expect(c.whatsappUrl.startsWith('https://wa.me/5541997452053?text=')).toBe(true);
  });
});
