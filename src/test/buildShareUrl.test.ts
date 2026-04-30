import { describe, it, expect } from 'vitest';
import { buildShareUrl, sanitizeSlug, isValidShareSlug } from '@/lib/buildShareUrl';

describe('buildShareUrl', () => {
  const REF = 'qaftogrqeyymewoofexc';

  it('gera URL absoluta apontando para a edge og-profile', () => {
    const url = buildShareUrl('joao-eletricista');
    expect(url).toMatch(new RegExp(`^https://${REF}\\.supabase\\.co/functions/v1/og-profile\\?slug=joao-eletricista`));
  });

  it('sanitiza caracteres inválidos', () => {
    expect(sanitizeSlug('João-Eletricista_2024!!')).toBe('joo-eletricista2024');
    expect(sanitizeSlug('  --abc--  ')).toBe('abc');
    expect(sanitizeSlug('A'.repeat(120))).toHaveLength(80);
  });

  it('aceita projectRef customizado', () => {
    const url = buildShareUrl('teste', { projectRef: 'staging-ref' });
    expect(url).toContain('https://staging-ref.supabase.co/functions/v1/og-profile');
  });

  it('inclui parâmetros UTM quando fornecidos', () => {
    const url = buildShareUrl('teste', {
      utm: { source: 'whatsapp', medium: 'share', campaign: 'profile' },
    });
    expect(url).toContain('utm_source=whatsapp');
    expect(url).toContain('utm_medium=share');
    expect(url).toContain('utm_campaign=profile');
  });

  it('devolve URL base quando slug é vazio/inválido', () => {
    expect(buildShareUrl('')).toBe(`https://${REF}.supabase.co/functions/v1/og-profile`);
    expect(buildShareUrl(null)).toBe(`https://${REF}.supabase.co/functions/v1/og-profile`);
    expect(buildShareUrl('!!!@@@')).toBe(`https://${REF}.supabase.co/functions/v1/og-profile`);
  });

  it('isValidShareSlug rejeita slugs malformados', () => {
    expect(isValidShareSlug('joao-eletricista')).toBe(true);
    expect(isValidShareSlug('a')).toBe(true);
    expect(isValidShareSlug('-leading')).toBe(false);
    expect(isValidShareSlug('trailing-')).toBe(false);
    expect(isValidShareSlug('UPPER')).toBe(false);
    expect(isValidShareSlug('com espaco')).toBe(false);
    expect(isValidShareSlug('')).toBe(false);
  });
});
