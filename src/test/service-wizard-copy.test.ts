/**
 * Testes para a copy contextual do ServiceWizard cobrindo o número exato
 * de serviços (1º, 2º, 3º, penúltimo, último) e modo edição (sem contagem).
 */
import { describe, it, expect } from 'vitest';
import { buildServiceCountdownCopy, ordinalPt } from '@/lib/serviceWizardCopy';

describe('serviceWizardCopy', () => {
  it('1º serviço — texto de boas-vindas', () => {
    const c = buildServiceCountdownCopy(1, 5);
    expect(c.title).toMatch(/1º serviço/i);
    expect(c.subtitle).toContain('5');
  });

  it('2º serviço — menciona ordinal e quantidade restante', () => {
    const c = buildServiceCountdownCopy(2, 5);
    expect(c.title).toContain('2º');
    expect(c.subtitle).toMatch(/restam 3/);
  });

  it('3º serviço — tom equivalente ao do 2º e penúltimo', () => {
    const c = buildServiceCountdownCopy(3, 5);
    expect(c.title).toContain('3º');
    expect(c.subtitle).toMatch(/portfólio/i);
    expect(c.subtitle).toMatch(/restam 2/);
  });

  it('penúltimo (4º de 5) — texto específico', () => {
    const c = buildServiceCountdownCopy(4, 5);
    expect(c.title).toMatch(/Penúltimo/i);
    expect(c.subtitle).toMatch(/restará 1/);
  });

  it('último — celebra fechamento do portfólio', () => {
    const c = buildServiceCountdownCopy(5, 5);
    expect(c.title).toMatch(/Último/i);
  });

  it('ordinalPt formata corretamente', () => {
    expect(ordinalPt(1)).toBe('1º');
    expect(ordinalPt(7)).toBe('7º');
  });
});
