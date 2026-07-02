import { describe, it, expect } from 'vitest';
import {
  sanitizePhone,
  toCanonical,
  validateWhatsapp,
  isValidWhatsApp,
  formatPhoneDisplay,
  autoFillWhatsApp,
  buildSmartMessage,
} from '@/lib/whatsapp';

/**
 * E2E mobile-first do fluxo de cadastro — validações pt-BR de identidade/contato.
 * Cobre o que o usuário digita em Step01 (nome+WhatsApp) e Step11 (Contact):
 *  - DDD inválido → mensagem pt-BR
 *  - WhatsApp curto/longo → mensagem pt-BR
 *  - Auto-fill WhatsApp a partir do telefone
 *  - Mensagem inteligente para envio (Step do plano + envio)
 */

const validateName = (raw: string): string | null => {
  const v = (raw || '').trim();
  if (!v) return 'Digite seu nome.';
  if (v.length < 2) return 'Nome muito curto.';
  if (v.length > 80) return 'Nome muito longo.';
  // Pelo menos uma letra
  if (!/[A-Za-zÀ-ÿ]/.test(v)) return 'Nome inválido.';
  return null;
};

describe('Cadastro — validação de nome em pt-BR', () => {
  it('rejeita vazio, muito curto e somente números', () => {
    expect(validateName('')).toBe('Digite seu nome.');
    expect(validateName(' ')).toBe('Digite seu nome.');
    expect(validateName('A')).toBe('Nome muito curto.');
    expect(validateName('123')).toBe('Nome inválido.');
  });
  it('aceita nomes BR comuns (com acentos)', () => {
    expect(validateName('João Pedro')).toBeNull();
    expect(validateName('Conceição')).toBeNull();
  });
});

describe('Cadastro — validação de WhatsApp em pt-BR', () => {
  it('mostra mensagem pt-BR para campo vazio', () => {
    const r = validateWhatsapp('');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.message).toMatch(/Informe o WhatsApp com DDD/i);
  });
  it('mostra mensagem pt-BR para DDD inválido', () => {
    // DDD 10 não existe (válidos são 11..99); 10 dígitos passa o length check e cai em invalid_ddd
    const r = validateWhatsapp('1099999999');
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.reason).toBe('invalid_ddd');
      expect(r.message).toMatch(/DDD inválido/i);
    }
  });
  it('mostra mensagem pt-BR para número curto', () => {
    const r = validateWhatsapp('41999');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe('too_short');
  });
  it('mostra mensagem pt-BR para número longo', () => {
    const r = validateWhatsapp('5541999999999999');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe('too_long');
  });
  it('aceita 11 dígitos com DDD válido', () => {
    expect(validateWhatsapp('41997452053').valid).toBe(true);
    expect(validateWhatsapp('(41) 99745-2053').valid).toBe(true);
  });
  it('aceita formato canônico 55+DDD+número', () => {
    expect(validateWhatsapp('554197452053').valid).toBe(true);
    expect(isValidWhatsApp('554197452053')).toBe(true);
  });
});

describe('Cadastro — sanitização e formatação', () => {
  it('sanitiza tirando caracteres não-numéricos e zeros à esquerda', () => {
    expect(sanitizePhone('(041) 99745-2053')).toBe('41997452053');
    expect(sanitizePhone('  +55 (41) 99745-2053  ')).toBe('5541997452053');
  });
  it('converte para canônico 55+DDD+número', () => {
    expect(toCanonical('41997452053')).toBe('5541997452053');
    expect(toCanonical('5541997452053')).toBe('5541997452053');
    expect(toCanonical('123')).toBe('');
  });
  it('formatPhoneDisplay aceita canônico e devolve (DD) 9XXXX-XXXX', () => {
    expect(formatPhoneDisplay('5541997452053')).toBe('(41) 99745-2053');
    expect(formatPhoneDisplay('41997452053')).toBe('(41) 99745-2053');
  });
  it('autoFill: WhatsApp vazio cai para o telefone', () => {
    expect(autoFillWhatsApp('', '41997452053')).toBe('5541997452053');
    // WhatsApp já preenchido prevalece
    expect(autoFillWhatsApp('11988887777', '41997452053')).toBe('5511988887777');
  });
});

describe('Cadastro — mensagem inteligente do envio (Step plano)', () => {
  it('inclui categoria e cidade/UF quando disponíveis', () => {
    const msg = buildSmartMessage('Maria', 'Encanador', 'Curitiba', 'PR');
    expect(msg).toContain('Olá Maria!');
    expect(msg).toContain('Preciso de ajuda com Encanador');
    expect(msg).toContain('Curitiba/PR');
    expect(msg).toMatch(/Podemos conversar\?$/);
  });
  it('cai em mensagem mais curta sem categoria/local', () => {
    const msg = buildSmartMessage('João');
    expect(msg).toContain('Olá João!');
    expect(msg).not.toMatch(/Preciso de ajuda com/);
  });
});
