import { describe, it, expect } from 'vitest';
import { computeHealth, computeDaysLeft } from '@/lib/sponsorBilling';

const now = () => new Date();
const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

describe('sponsorBilling.computeHealth', () => {
  it('retorna healthy quando não há ciclo', () => {
    expect(computeHealth(null)).toBe('healthy');
  });

  it('marca expiring_soon quando ciclo pago vence em ≤7 dias', () => {
    expect(
      computeHealth({ status: 'paid', cycle_end: addDays(3), grace_until: null }),
    ).toBe('expiring_soon');
  });

  it('marca awaiting_payment quando status é overdue ou awaiting_payment', () => {
    expect(
      computeHealth({ status: 'overdue', cycle_end: addDays(-2), grace_until: null }),
    ).toBe('awaiting_payment');
    expect(
      computeHealth({ status: 'awaiting_payment', cycle_end: addDays(5), grace_until: null }),
    ).toBe('awaiting_payment');
  });

  it('marca grace quando status é grace', () => {
    expect(
      computeHealth({ status: 'grace', cycle_end: addDays(-3), grace_until: addDays(4) }),
    ).toBe('grace');
  });

  it('marca expired quando ciclo passou e não está em grace', () => {
    expect(
      computeHealth({ status: 'pending', cycle_end: addDays(-1), grace_until: null }),
    ).toBe('expired');
    expect(
      computeHealth({ status: 'cancelled', cycle_end: addDays(10), grace_until: null }),
    ).toBe('expired');
  });

  it('marca healthy quando pago e vencimento longe', () => {
    expect(
      computeHealth({ status: 'paid', cycle_end: addDays(30), grace_until: null }),
    ).toBe('healthy');
  });
});

describe('sponsorBilling.computeDaysLeft', () => {
  it('retorna null quando não há data', () => {
    expect(computeDaysLeft(null)).toBeNull();
  });

  it('retorna 0 quando já passou', () => {
    expect(computeDaysLeft(addDays(-2))).toBe(0);
  });

  it('arredonda para cima dias positivos', () => {
    const d = computeDaysLeft(addDays(5));
    expect(d).toBeGreaterThanOrEqual(5);
    expect(d).toBeLessThanOrEqual(6);
  });
});
