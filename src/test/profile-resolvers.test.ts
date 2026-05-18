import { describe, it, expect } from 'vitest';
import {
  resolveWhatsapp,
  resolvePhone,
  resolveDisplayName,
  resolveAvatar,
  resolveCity,
  hasAnyContact,
} from '@/lib/profileResolvers';

describe('profileResolvers — read consolidation layer', () => {
  describe('resolveWhatsapp', () => {
    it('A: provider has whatsapp, profile empty → provider wins', () => {
      expect(resolveWhatsapp({ whatsapp: '5541999999999' }, {})).toBe('5541999999999');
    });
    it('B: provider empty, profile has whatsapp → profile fallback', () => {
      expect(resolveWhatsapp({}, { whatsapp: '5541888888888' })).toBe('5541888888888');
    });
    it('falls back to provider.phone then profile.phone', () => {
      expect(resolveWhatsapp({ phone: '4133333333' }, {})).toBe('4133333333');
      expect(resolveWhatsapp({}, { phone: '4122222222' })).toBe('4122222222');
    });
    it('C: all empty → empty string', () => {
      expect(resolveWhatsapp({}, {})).toBe('');
      expect(resolveWhatsapp(null, null)).toBe('');
    });
    it('ignores whitespace-only values', () => {
      expect(resolveWhatsapp({ whatsapp: '   ' }, { whatsapp: '5541777777777' })).toBe(
        '5541777777777',
      );
    });
  });

  describe('resolvePhone', () => {
    it('phone-first priority', () => {
      expect(resolvePhone({ phone: '4111111111', whatsapp: '5541222' }, {})).toBe('4111111111');
    });
    it('falls back to whatsapp fields', () => {
      expect(resolvePhone({}, { whatsapp: '5541999' })).toBe('5541999');
    });
  });

  describe('resolveDisplayName', () => {
    it('profile.full_name wins', () => {
      expect(resolveDisplayName({ business_name: 'ACME' }, { full_name: 'João Silva' })).toBe(
        'João Silva',
      );
    });
    it('falls back to business_name then legal_name', () => {
      expect(resolveDisplayName({ business_name: 'ACME' }, {})).toBe('ACME');
      expect(resolveDisplayName({ legal_name: 'ACME LTDA' }, {})).toBe('ACME LTDA');
    });
    it('empty when nothing set', () => {
      expect(resolveDisplayName({}, {})).toBe('');
    });
  });

  describe('resolveAvatar', () => {
    it('profile.avatar_url wins over provider.photo_url', () => {
      expect(
        resolveAvatar({ photo_url: 'p.jpg' }, { avatar_url: 'a.jpg' }),
      ).toBe('a.jpg');
    });
    it('falls back to provider.photo_url', () => {
      expect(resolveAvatar({ photo_url: 'p.jpg' }, {})).toBe('p.jpg');
    });
    it('empty when both missing', () => {
      expect(resolveAvatar({}, {})).toBe('');
    });
  });

  describe('resolveCity', () => {
    it('provider.city wins over profile.city', () => {
      expect(resolveCity({ city: 'Curitiba' }, { city: 'São Paulo' })).toBe('Curitiba');
    });
    it('falls back to profile.city', () => {
      expect(resolveCity({}, { city: 'São Paulo' })).toBe('São Paulo');
    });
  });

  describe('hasAnyContact', () => {
    it('true when any field present', () => {
      expect(hasAnyContact({ whatsapp: '5541999' }, {})).toBe(true);
      expect(hasAnyContact({}, { phone: '4133' })).toBe(true);
    });
    it('false when all empty', () => {
      expect(hasAnyContact({}, {})).toBe(false);
      expect(hasAnyContact(null, null)).toBe(false);
    });
  });
});
