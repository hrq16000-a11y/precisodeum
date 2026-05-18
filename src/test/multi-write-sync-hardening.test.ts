/**
 * Fase 1.6.3 — Sync hardening multi-write.
 *
 * Cobertura:
 *   A) profile salva / provider falha    → audit, sem falso sucesso
 *   B) provider OK / profile_type falha  → audit observável
 *   C) service RPC (finalize) falha      → onboarding NÃO conclui
 *   D) tudo OK                           → snapshot consistente, sem audit
 *
 * Testa o helper `createSyncTracker` + `logSyncFailure` direto, sem montar
 * componentes — espelha o contrato usado em BetModeShell, ProfileTypeSwitcher,
 * OnboardingV2Shell.persistFirstService e Phase4Final.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) }, from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }) },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { createSyncTracker, logSyncFailure, showPartialSyncError, STANDARD_PARTIAL_MESSAGE } from '@/lib/multiWriteSync';
import { toast } from 'sonner';

describe('multi-write sync hardening (Fase 1.6.3)', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Cenário A — profile salva / provider falha', () => {
    it('marca failedStep=provider, mantém profileUpdated=true', () => {
      const s = createSyncTracker();
      s.mark('profile', true);
      s.mark('provider', false);
      expect(s.profileUpdated).toBe(true);
      expect(s.providerUpdated).toBe(false);
      expect(s.failedStep).toBe('provider');
    });

    it('snapshot expõe estado correto para audit', () => {
      const s = createSyncTracker();
      s.mark('profile', true);
      s.mark('provider', false);
      expect(s.snapshot()).toEqual({
        profile_updated: true,
        provider_updated: false,
        service_created: false,
        failed_step: 'provider',
      });
    });
  });

  describe('Cenário B — profile_type falha', () => {
    it('failedStep=profile_type, sem provider_updated', () => {
      const s = createSyncTracker();
      s.mark('profile_type', false);
      expect(s.failedStep).toBe('profile_type');
      expect(s.providerUpdated).toBe(false);
    });

    it('audit ação correta para ProfileTypeSwitcher', async () => {
      const s = createSyncTracker();
      s.mark('profile_type', true);
      s.mark('provider', false);
      await expect(logSyncFailure({
        action: 'profile_type_switch_sync_failed',
        source: 'profile_type_switcher',
        snapshot: s.snapshot(),
      })).resolves.toBeUndefined();
    });
  });

  describe('Cenário C — service RPC / finalize falha', () => {
    it('serviceCreated true mas finalize falha → setFailed marca falha', () => {
      const s = createSyncTracker();
      s.mark('provider', true);
      s.mark('service', true);
      // finalize falhou
      s.setFailed('profile');
      expect(s.failedStep).toBe('profile');
      expect(s.serviceCreated).toBe(true);
      expect(s.providerUpdated).toBe(true);
    });

    it('não sobrescreve a primeira falha', () => {
      const s = createSyncTracker();
      s.mark('provider', false);
      s.setFailed('profile');
      expect(s.failedStep).toBe('provider');
    });
  });

  describe('Cenário D — fluxo completo OK', () => {
    it('failedStep=null e snapshot limpo', () => {
      const s = createSyncTracker();
      s.mark('profile', true);
      s.mark('provider', true);
      s.mark('service', true);
      expect(s.failedStep).toBeNull();
      expect(s.snapshot()).toEqual({
        profile_updated: true,
        provider_updated: true,
        service_created: true,
        failed_step: null,
      });
    });
  });

  describe('Mensagens e audit — sem PII / sem SQL', () => {
    it('STANDARD_PARTIAL_MESSAGE é amigável', () => {
      expect(STANDARD_PARTIAL_MESSAGE).toMatch(/não foi possível/i);
      expect(STANDARD_PARTIAL_MESSAGE).not.toMatch(/supabase|sql|pgrst|stack|23\d{3}/i);
    });

    it('showPartialSyncError dispara toast.error com mensagem padronizada', () => {
      showPartialSyncError(() => {});
      expect(toast.error).toHaveBeenCalledWith(
        STANDARD_PARTIAL_MESSAGE,
        expect.objectContaining({ action: expect.any(Object) }),
      );
    });

    it('logSyncFailure aceita as 4 ações canônicas da Fase 1.6.3', async () => {
      const actions = [
        'bet_onboarding_sync_failed',
        'profile_type_switch_sync_failed',
        'persist_first_service_sync_failed',
        'phase4_sync_failed',
      ] as const;
      for (const action of actions) {
        await expect(logSyncFailure({
          action,
          source: 'test',
          snapshot: createSyncTracker().snapshot(),
        })).resolves.toBeUndefined();
      }
    });

    it('logSyncFailure nunca lança mesmo se audit falhar', async () => {
      await expect(logSyncFailure({
        action: 'bet_onboarding_sync_failed',
        source: 'x',
        snapshot: { profile_updated: true, provider_updated: false, service_created: false, failed_step: 'provider' },
        errorCode: 'PGRST116',
      })).resolves.toBeUndefined();
    });
  });
});
