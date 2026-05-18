import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail } from '@/lib/validation/emailValidation';

describe('isValidEmail — aceita formatos comuns válidos', () => {
  it.each([
    'contato@gmail.com',
    'empresa@hotmail.com.br',
    'nome.sobrenome@yahoo.com',
    'user+tag@provedor.com',
    'a@b.co',
    '  USER@MAIL.COM  ',
  ])('aceita %s', (e) => {
    expect(isValidEmail(e)).toBe(true);
  });
});

describe('isValidEmail — rejeita formatos inválidos óbvios', () => {
  it.each([
    '',
    'teste',
    'teste@',
    '@gmail.com',
    'gmail.com',
    'nome@gmail',
    'nome@gmail.',
    'nome@gmail.c',
    'nome@gmail.comc',
    'nome@gmail.comm',
    'a@@b.com',
    'a b@c.com',
    'a@b.c',
    'a@-b.com',
    'a@b-.com',
    'a@b..com',
    '.a@b.com',
    'a.@b.com',
    'a..b@c.com',
  ])('rejeita %s', (e) => {
    expect(isValidEmail(e)).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('faz trim + lowercase', () => {
    expect(normalizeEmail('  Foo@Bar.COM  ')).toBe('foo@bar.com');
  });
});
