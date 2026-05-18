import { describe, it, expect, vi, beforeEach } from 'vitest';

const auditInsert = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: vi.fn(() => ({ insert: auditInsert })),
  },
}));

import {
  resolveContactOwner,
  shouldWriteProfileContact,
  shouldWriteProviderContact,
  getCanonicalContactSource,
  detectContactConflict,
  maybeLogContactOwnershipConflict,
} from '@/lib/contactOwnership';

describe('FASE 1.6.6 · contact ownership boundary', () => {
  beforeEach(() => { auditInsert.mockClear(); });

  describe('A · client owns profiles.{phone,whatsapp}', () => {
    it('owner = profile', () => {
      expect(resolveContactOwner('client')).toBe('profile');
      expect(getCanonicalContactSource('client')).toBe('profile');
    });
    it('should write profile, must NOT write provider', () => {
      expect(shouldWriteProfileContact('client')).toBe(true);
      expect(shouldWriteProviderContact('client')).toBe(false);
    });
  });

  describe('B · provider owns providers.{phone,whatsapp}, profile mirror', () => {
    it('owner = provider for provider/rh', () => {
      expect(resolveContactOwner('provider')).toBe('provider');
      expect(resolveContactOwner('rh')).toBe('provider');
    });
    it('should write provider; profile permitted as compat mirror by default', () => {
      expect(shouldWriteProviderContact('provider')).toBe(true);
      expect(shouldWriteProfileContact('provider')).toBe(true);
      expect(shouldWriteProfileContact('provider', { mirrorForProvider: false })).toBe(false);
    });
  });

  describe('C · conflict detection (provider account)', () => {
    it('no conflict when values match after normalization', () => {
      const r = detectContactConflict('provider', 'whatsapp', '(21) 99999-9999', '5521999999999');
      expect(r.conflict).toBe(false);
    });
    it('conflict when both set but differ', () => {
      const r = detectContactConflict('provider', 'whatsapp', '5521988887777', '5521999999999');
      expect(r.conflict).toBe(true);
      expect(r.profileHasValue).toBe(true);
      expect(r.providerHasValue).toBe(true);
    });
    it('conflict when owner empty but profile set (mirror missing on owner)', () => {
      const r = detectContactConflict('provider', 'phone', '5521999999999', '');
      expect(r.conflict).toBe(true);
    });
    it('no conflict for client accounts (ownership not provider)', () => {
      const r = detectContactConflict('client', 'whatsapp', '5521988887777', '5521999999999');
      expect(r.conflict).toBe(false);
    });
  });

  describe('D · audit log (no PII)', () => {
    it('emits contact_ownership_conflict with booleans only', async () => {
      await maybeLogContactOwnershipConflict({
        source: 'unit_test',
        profileType: 'provider',
        field: 'whatsapp',
        profileValue: '5521988887777',
        providerValue: '5521999999999',
      });
      expect(auditInsert).toHaveBeenCalledTimes(1);
      const payload = auditInsert.mock.calls[0][0];
      expect(payload.action).toBe('contact_ownership_conflict');
      expect(payload.resource_type).toBe('contact_ownership');
      const details = payload.details;
      expect(details.source).toBe('unit_test');
      expect(details.profile_type).toBe('provider');
      expect(details.field).toBe('whatsapp');
      expect(details.profile_has_value).toBe(true);
      expect(details.provider_has_value).toBe(true);
      // PII guard
      const serialized = JSON.stringify(details);
      expect(serialized).not.toContain('5521988887777');
      expect(serialized).not.toContain('5521999999999');
    });

    it('does NOT emit when no conflict', async () => {
      await maybeLogContactOwnershipConflict({
        source: 'unit_test',
        profileType: 'provider',
        field: 'whatsapp',
        profileValue: '5521999999999',
        providerValue: '(21) 99999-9999',
      });
      expect(auditInsert).not.toHaveBeenCalled();
    });

    it('does NOT emit for client accounts', async () => {
      await maybeLogContactOwnershipConflict({
        source: 'unit_test',
        profileType: 'client',
        field: 'phone',
        profileValue: '5521988887777',
        providerValue: '5521999999999',
      });
      expect(auditInsert).not.toHaveBeenCalled();
    });

    it('fail-soft: swallows insert errors', async () => {
      auditInsert.mockRejectedValueOnce(new Error('boom'));
      await expect(
        maybeLogContactOwnershipConflict({
          source: 'unit_test',
          profileType: 'provider',
          field: 'whatsapp',
          profileValue: '5521988887777',
          providerValue: '',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('E · read layer compat (resolvers untouched)', async () => {
    it('profileResolvers continues to expose provider-first priority for contact', async () => {
      const { resolveWhatsapp, resolvePhone } = await import('@/lib/profileResolvers');
      expect(resolveWhatsapp({ whatsapp: '5541999' }, { whatsapp: '5541888' })).toBe('5541999');
      expect(resolvePhone({ phone: '4111111111' }, { phone: '4122222222' })).toBe('4111111111');
    });
  });
});
