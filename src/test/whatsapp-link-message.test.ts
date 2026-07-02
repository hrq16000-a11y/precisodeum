/**
 * Cobre o disparo de WhatsApp dos leads:
 *  - Sanitização e canonicalização do telefone (toCanonical)
 *  - Validação detalhada (validateWhatsapp)
 *  - Geração do link wa.me com mensagem inteligente
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizePhone,
  toCanonical,
  validateWhatsapp,
  whatsappWebLink,
  buildSmartMessage,
  formatToWhatsApp,
} from '@/lib/whatsapp';

describe('whatsapp helpers — leads', () => {
  it('sanitiza e canonicaliza telefone BR (DDD+9 dígitos → 55…)', () => {
    expect(sanitizePhone('(41) 99745-2053')).toBe('41997452053');
    expect(toCanonical('(41) 99745-2053')).toBe('5541997452053');
    expect(toCanonical('5541997452053')).toBe('5541997452053');
    // Inválidos viram string vazia (não link quebrado)
    expect(toCanonical('123')).toBe('');
  });

  it('validateWhatsapp retorna razões acionáveis', () => {
    expect(validateWhatsapp('').reason).toBe('empty');
    expect(validateWhatsapp('123').reason).toBe('too_short');
    expect(validateWhatsapp('999999999999999').reason).toBe('too_long');
    // DDD começando em 0 sai por sanitização e cai em too_short/invalid_format dependendo do shape
    expect(validateWhatsapp('0099745-2053').valid).toBe(false);
    // DDD numérico < 11 (ex: 09) é rejeitado como invalid_ddd
    expect(validateWhatsapp('1099745-2053').reason).toBe('invalid_ddd');
    expect(validateWhatsapp('41997452053').valid).toBe(true);
  });

  it('whatsappWebLink usa wa.me/{canonical} e codifica a mensagem', () => {
    const link = whatsappWebLink('41997452053', 'Olá João');
    expect(link).toContain('https://wa.me/5541997452053');
    expect(link).toContain('text=Ol%C3%A1%20Jo%C3%A3o');
  });

  it('buildSmartMessage compõe nome + categoria + cidade quando disponíveis', () => {
    const msg = buildSmartMessage('João', 'Eletricista', 'Curitiba', 'PR');
    expect(msg).toContain('Olá João');
    expect(msg).toContain('Eletricista');
    expect(msg).toContain('Curitiba/PR');
  });

  it('formatToWhatsApp == toCanonical (paridade)', () => {
    const a = formatToWhatsApp('(41) 99745-2053');
    const b = toCanonical('(41) 99745-2053');
    expect(a).toBe(b);
  });
});
