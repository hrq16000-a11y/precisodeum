import { describe, it, expect } from 'vitest';
import {
  isValidFullName,
  normalizeFullName,
  shouldEnforceFullName,
  FULL_NAME_INVALID_MESSAGE,
} from '@/lib/validation/fullNameValidation';

describe('fullNameValidation · aceita nomes válidos', () => {
  for (const name of [
    'João Silva',
    'Maria de Souza',
    'Carlos Eduardo Lima',
    'Ana Paula',
    'José da Silva',
    'Ana Paula Lima',
    "D'Ávila Souza",
    'Jean-Pierre Aragão',
  ]) {
    it(`aceita "${name}"`, () => {
      expect(isValidFullName(name)).toBe(true);
    });
  }
});

describe('fullNameValidation · rejeita lixo', () => {
  for (const name of [
    '',
    '   ',
    'a',
    'João',
    '123456',
    'empresa123',
    'teste',
    'admin',
    'admin admin',
    'a b',
    '....',
    'xxxxxxxx',
    'aaaaa Silva',
    'teste@gmail.com',
    'www.site.com',
    'https://x.com aqui',
    'constrular.construcao.reforma',
    'João 123',
  ]) {
    it(`rejeita "${name}"`, () => {
      expect(isValidFullName(name)).toBe(false);
    });
  }
});

describe('fullNameValidation · helpers', () => {
  it('normaliza espaços', () => {
    expect(normalizeFullName('  João   Silva  ')).toBe('João Silva');
    expect(normalizeFullName(null)).toBe('');
  });

  it('shouldEnforceFullName só dispara em mudança', () => {
    expect(shouldEnforceFullName('João Silva', 'João Silva')).toBe(false);
    expect(shouldEnforceFullName(' João  Silva ', 'João Silva')).toBe(false);
    expect(shouldEnforceFullName('Maria', 'João Silva')).toBe(true);
    expect(shouldEnforceFullName('João Silva', '')).toBe(true);
  });

  it('expõe mensagem amigável', () => {
    expect(FULL_NAME_INVALID_MESSAGE).toMatch(/nome completo/i);
    expect(FULL_NAME_INVALID_MESSAGE).not.toMatch(/!!/);
  });
});
