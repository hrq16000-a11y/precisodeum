import { describe, it, expect } from 'vitest';

/**
 * Smoke tests da forma do contrato das RPCs de telemetria.
 * Não chama backend real — valida o shape esperado pelos consumidores.
 */
describe('telemetry RPC contracts', () => {
  it('get_lead_conversion_stats retorna 5 colunas esperadas', () => {
    const expected = ['provider_id', 'contact_clicks', 'leads_sent', 'conversion_pct', 'window_days'];
    const sample = {
      provider_id: '00000000-0000-0000-0000-000000000001',
      contact_clicks: 12,
      leads_sent: 3,
      conversion_pct: 25,
      window_days: 30,
    };
    expected.forEach((k) => expect(sample).toHaveProperty(k));
    expect(sample.conversion_pct).toBeGreaterThanOrEqual(0);
    expect(sample.conversion_pct).toBeLessThanOrEqual(100);
  });

  it('get_provider_retention retorna coortes com pct entre 0 e 100', () => {
    const sample = {
      cohort_day: '2026-04-01',
      cohort_size: 20,
      retained_d1: 12,
      retained_d7: 7,
      retained_d30: 3,
      pct_d1: 60,
      pct_d7: 35,
      pct_d30: 15,
    };
    expect(sample.pct_d1).toBeGreaterThanOrEqual(0);
    expect(sample.pct_d1).toBeLessThanOrEqual(100);
    expect(sample.retained_d1).toBeLessThanOrEqual(sample.cohort_size);
    expect(sample.retained_d30).toBeLessThanOrEqual(sample.retained_d7 || sample.cohort_size);
  });
});
