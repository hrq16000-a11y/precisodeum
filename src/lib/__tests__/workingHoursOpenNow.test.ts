import { describe, it, expect } from 'vitest';
import { isOpenNow } from '../workingHoursOpenNow';
import type { WorkingHoursStruct } from '@/components/onboarding/wizard/phases/v2/workingHours';

const monday = (h: number, m = 0) => new Date(2025, 0, 6, h, m, 0); // 06/01/2025 = segunda
const sunday = (h: number, m = 0) => new Date(2025, 0, 5, h, m, 0); // 05/01/2025 = domingo
const tuesday = (h: number, m = 0) => new Date(2025, 0, 7, h, m, 0);

describe('isOpenNow', () => {
  it('null/empty → false', () => {
    expect(isOpenNow(null)).toBe(false);
    expect(isOpenNow({ ranges: [] })).toBe(false);
  });

  it('Seg–Sex 08–18 às segunda 12h → aberto', () => {
    const s: WorkingHoursStruct = {
      ranges: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' }],
    };
    expect(isOpenNow(s, monday(12))).toBe(true);
  });

  it('Seg–Sex 08–18 às segunda 22h → fechado', () => {
    const s: WorkingHoursStruct = {
      ranges: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' }],
    };
    expect(isOpenNow(s, monday(22))).toBe(false);
  });

  it('Seg–Sex 08–18 no sábado → fechado', () => {
    const s: WorkingHoursStruct = {
      ranges: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' }],
    };
    const sat = new Date(2025, 0, 11, 12);
    expect(isOpenNow(s, sat)).toBe(false);
  });

  it('faixa cruzando meia-noite (22→06) às 02h da terça → aberto (vindo de segunda)', () => {
    const s: WorkingHoursStruct = {
      ranges: [{ days: ['mon'], start: '22:00', end: '06:00' }],
    };
    expect(isOpenNow(s, tuesday(2))).toBe(true);
  });

  it('faixa cruzando meia-noite (22→06) às 23h de segunda → aberto', () => {
    const s: WorkingHoursStruct = {
      ranges: [{ days: ['mon'], start: '22:00', end: '06:00' }],
    };
    expect(isOpenNow(s, monday(23))).toBe(true);
  });

  it('24h em todos os dias → sempre aberto', () => {
    const s: WorkingHoursStruct = {
      ranges: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], start: '00:00', end: '24:00' }],
    };
    expect(isOpenNow(s, sunday(3))).toBe(true);
    expect(isOpenNow(s, monday(15))).toBe(true);
  });

  it('limite exato — fim do horário não conta como aberto', () => {
    const s: WorkingHoursStruct = {
      ranges: [{ days: ['mon'], start: '08:00', end: '18:00' }],
    };
    expect(isOpenNow(s, monday(18))).toBe(false);
    expect(isOpenNow(s, monday(17, 59))).toBe(true);
  });
});
