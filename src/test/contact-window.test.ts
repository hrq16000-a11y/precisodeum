import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONTACT_HOURS,
  matchesContactHours,
  normalizeContactHours,
  suggestNextSlot,
  formatPreferredWindow,
} from '@/lib/contactWindow';

describe('contactWindow', () => {
  it('normaliza payload sujo para shape seguro', () => {
    const out = normalizeContactHours({ days: [9, 1, 'x', 2], periods: ['morning', 'lol'], timezone: '' });
    expect(out.days).toEqual([1, 2]);
    expect(out.periods).toEqual(['morning']);
    expect(out.timezone).toBe('America/Sao_Paulo');
  });

  it('match: bate quando dia e período estão na janela', () => {
    expect(matchesContactHours(DEFAULT_CONTACT_HOURS, { day: 2, period: 'morning' })).toBe('match');
  });

  it('mismatch: domingo fora da janela padrão', () => {
    expect(matchesContactHours(DEFAULT_CONTACT_HOURS, { day: 0, period: 'morning' })).toBe('mismatch');
  });

  it('unspecified: pref nula ou inválida', () => {
    expect(matchesContactHours(DEFAULT_CONTACT_HOURS, null)).toBe('unspecified');
    expect(matchesContactHours(DEFAULT_CONTACT_HOURS, { day: 99, period: 'morning' as any })).toBe('unspecified');
  });

  it('suggestNextSlot retorna primeiro slot válido em hours customizadas', () => {
    // só sábado, só noite — força pular vários dias
    const hours = { days: [6], periods: ['evening' as const], timezone: 'America/Sao_Paulo' };
    const r = suggestNextSlot(hours, new Date('2026-05-04T10:00:00-03:00')); // segunda
    expect(r).not.toBeNull();
    expect(r!.day).toBe(6);
    expect(r!.period).toBe('evening');
  });

  it('suggestNextSlot retorna null quando hours vazio', () => {
    expect(suggestNextSlot({ days: [], periods: [], timezone: 'America/Sao_Paulo' })).toBeNull();
  });

  it('formatPreferredWindow usa "Hoje/Amanhã" quando há iso_date', () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const txt = formatPreferredWindow({ day: today.getDay(), period: 'afternoon', iso_date: iso }, today);
    expect(txt.toLowerCase()).toContain('hoje');
    expect(txt.toLowerCase()).toContain('tarde');
  });
});
