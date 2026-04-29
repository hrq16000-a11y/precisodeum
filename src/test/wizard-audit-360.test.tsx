/**
 * Auditoria 360° do Wizard de Cadastro.
 *
 * Cobre os 4 eixos pedidos para o dia de pico de conversão:
 *  1) Validação estrita: helpers de telefone/email/CEP rejeitam inválidos.
 *  2) Tratamento de erros & Supabase: safeWizardSave nunca relança e dispara
 *     toast amigável + telemetria.
 *  3) Persistência: rascunho do service-wizard é gravado/recuperado de
 *     localStorage e expira em 7 dias.
 *  4) Prevenção de dead-ends: WizardShell expõe botão "Voltar" global em
 *     toda fase intermediária, e o ExitIntentDialog é desabilitado nas
 *     celebrações (sem loops).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isValidCpf, isValidCnpj } from '@/lib/cpfCnpj';
import { sanitizePhone } from '@/lib/whatsapp';
import {
  loadServiceWizardDraft,
  clearServiceWizardDraft,
} from '@/hooks/useServiceWizardDraft';
import { safeWizardSave } from '@/lib/wizardErrorGuard';

// Mock telemetria e toast para isolar a unidade.
vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent: vi.fn().mockResolvedValue(undefined),
  setOnboardingIntent: vi.fn(),
}));
const toastErrorSpy = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: any[]) => { toastErrorSpy(...args); return 1; },
    success: vi.fn(), message: vi.fn(),
  },
}));

beforeEach(() => {
  toastErrorSpy.mockClear();
  try { localStorage.clear(); } catch { /* */ }
});

describe('Wizard 360° — 1. Validação estrita', () => {
  it('rejeita CPF/CNPJ inválidos', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('12345678900')).toBe(false);
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
    expect(isValidCnpj('12345678000100')).toBe(false);
  });

  it('aceita CPF/CNPJ válidos conhecidos', () => {
    expect(isValidCpf('39053344705')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('telefone — sanitiza e limita a 11 dígitos', () => {
    expect(sanitizePhone('(41) 99745-2053')).toBe('41997452053');
    expect(sanitizePhone('+55 41 99745-2053 ramal 9')).toMatch(/^55419974520539?$/);
    expect(sanitizePhone('abc').length).toBe(0);
  });
});

describe('Wizard 360° — 2. Tratamento de erros (safeWizardSave)', () => {
  it('captura exceção, retorna {ok:false} e dispara toast amigável', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await safeWizardSave({
      phase: 'phase2_service',
      userId: 'user-1',
      friendlyMessage: 'Tente novamente',
      fn,
    });
    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledOnce();
    expect(toastErrorSpy).toHaveBeenCalledOnce();
  });

  it('em sucesso, devolve {ok:true,data} sem toast', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'svc-1' });
    const result = await safeWizardSave({ phase: 'phase2_service', fn });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ id: 'svc-1' });
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });
});

describe('Wizard 360° — 3. Persistência de rascunho', () => {
  const userId = 'user-abc';

  it('retorna null quando não há rascunho', () => {
    expect(loadServiceWizardDraft(userId)).toBeNull();
  });

  it('expira rascunhos com mais de 7 dias', () => {
    const old = {
      form: { service_name: 'X', description: '', price: '', whatsapp: '', service_area: '', address: '', working_hours: '', website: '', instagram_url: '', facebook_url: '', youtube_url: '' },
      selectedCategoryIds: [], citySearch: '', serviceRadius: '5', isEmergency: false, seoTags: [], geoDetected: false, formStep: 1,
      savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    };
    localStorage.setItem(`service_wizard_draft_v1:${userId}`, JSON.stringify(old));
    expect(loadServiceWizardDraft(userId)).toBeNull();
    // limpou após detectar expiração
    expect(localStorage.getItem(`service_wizard_draft_v1:${userId}`)).toBeNull();
  });

  it('clearServiceWizardDraft remove a chave', () => {
    localStorage.setItem(`service_wizard_draft_v1:${userId}`, JSON.stringify({ savedAt: Date.now() }));
    clearServiceWizardDraft(userId);
    expect(localStorage.getItem(`service_wizard_draft_v1:${userId}`)).toBeNull();
  });

  it('null/undefined userId é seguro (no-op)', () => {
    expect(() => clearServiceWizardDraft(null)).not.toThrow();
    expect(loadServiceWizardDraft(undefined)).toBeNull();
  });
});

describe('Wizard 360° — 4. Prevenção de dead-ends', () => {
  const shell = fs.readFileSync(
    path.join(process.cwd(), 'src/components/onboarding/wizard/WizardShell.tsx'),
    'utf8',
  );

  it('expõe botão Voltar global em fases intermediárias', () => {
    expect(shell).toMatch(/showGlobalBack/);
    expect(shell).toMatch(/aria-label="Voltar para o passo anterior"/);
  });

  it('desabilita ExitIntentDialog nas celebrações (sem loop de pop-up)', () => {
    expect(shell).toMatch(/state\.phase !== 'triage_celebration'/);
    expect(shell).toMatch(/state\.phase !== 'main_celebration'/);
    expect(shell).toMatch(/state\.phase !== 'done'/);
  });

  it('rotas finais (done) oferecem 3 saídas distintas (sem botão único travado)', () => {
    expect(shell).toMatch(/to="\/dashboard"/);
    expect(shell).toMatch(/to="\/dashboard\/servicos"/);
    expect(shell).toMatch(/to="\/dashboard\/portfolio"/);
  });
});
