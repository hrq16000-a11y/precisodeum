import { describe, it, expect } from 'vitest';
import {
  normalizePhoneBR,
  isValidPhoneBR,
  toDisplayPhoneBR,
  shouldEnforcePhone,
  PHONE_INVALID_MESSAGE,
} from '@/lib/validation/phoneNormalization';

describe('phoneNormalization · normalizePhoneBR → 5521999999999', () => {
  for (const input of [
    '(21) 99999-9999',
    '21999999999',
    '5521999999999',
    '+55 21 99999-9999',
    '  21 99999-9999  ',
  ]) {
    it(`normaliza "${input}"`, () => {
      expect(normalizePhoneBR(input)).toBe('5521999999999');
    });
  }

  it('aceita fixo 10 dígitos', () => {
    expect(normalizePhoneBR('(21) 3333-4444')).toBe('552133334444');
  });

  it('retorna vazio para entradas inválidas', () => {
    expect(normalizePhoneBR('123')).toBe('');
    expect(normalizePhoneBR('abcdefgh')).toBe('');
    expect(normalizePhoneBR(null)).toBe('');
    expect(normalizePhoneBR(undefined)).toBe('');
  });
});

describe('phoneNormalization · isValidPhoneBR', () => {
  for (const input of [
    '(21) 99999-9999',
    '21999999999',
    '5521999999999',
    '+55 21 99999-9999',
  ]) {
    it(`aceita "${input}"`, () => {
      expect(isValidPhoneBR(input)).toBe(true);
    });
  }

  for (const input of ['', '123', 'abcdefgh', '0000000000', '5555555555555']) {
    it(`rejeita "${input}"`, () => {
      expect(isValidPhoneBR(input)).toBe(false);
    });
  }
});

describe('phoneNormalization · display & enforce', () => {
  it('toDisplayPhoneBR formata canônico', () => {
    expect(toDisplayPhoneBR('5521999999999')).toBe('(21) 99999-9999');
    expect(toDisplayPhoneBR('21999999999')).toBe('(21) 99999-9999');
    expect(toDisplayPhoneBR('')).toBe('');
  });

  it('shouldEnforcePhone só dispara em mudança', () => {
    expect(shouldEnforcePhone('(21) 99999-9999', '5521999999999')).toBe(false);
    expect(shouldEnforcePhone('5521999999999', '5521999999999')).toBe(false);
    expect(shouldEnforcePhone('5521988887777', '5521999999999')).toBe(true);
    expect(shouldEnforcePhone('', '')).toBe(false);
    expect(shouldEnforcePhone('21999999999', '')).toBe(true);
  });

  it('mensagem amigável', () => {
    expect(PHONE_INVALID_MESSAGE).toMatch(/whatsapp/i);
  });
});
