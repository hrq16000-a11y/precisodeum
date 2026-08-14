import { describe, expect, it } from 'vitest';
import {
  deviceOf,
  formatMetric,
  normalizeRoute,
  percentile,
  rateMetric,
  summarizeByRoute,
  summarizeDaily,
  summarizeMetric,
  type VitalSample,
} from '@/lib/webVitals/summary';

const sample = (over: Partial<VitalSample>): VitalSample => ({
  metric: 'LCP',
  value: 1000,
  route: '/',
  viewport: '1280x800',
  created_at: '2026-08-14T10:00:00.000Z',
  ...over,
});

describe('webVitals/summary', () => {
  it('classifica métricas pelos limiares do Google', () => {
    expect(rateMetric('LCP', 2400)).toBe('good');
    expect(rateMetric('LCP', 3000)).toBe('needs-improvement');
    expect(rateMetric('LCP', 5000)).toBe('poor');
    expect(rateMetric('CLS', 0.05)).toBe('good');
    expect(rateMetric('CLS', 0.4)).toBe('poor');
    expect(rateMetric('INP', 150)).toBe('good');
  });

  it('calcula percentis com lista vazia protegida', () => {
    expect(percentile([], 75)).toBeNull();
    expect(percentile([100, 200, 300, 400], 75)).toBe(300);
    expect(percentile([5], 50)).toBe(5);
  });

  it('resume uma métrica com distribuição de ratings', () => {
    const s = summarizeMetric('LCP', [
      sample({ value: 1000 }),
      sample({ value: 2000 }),
      sample({ value: 3000 }),
      sample({ value: 9000 }),
    ]);
    expect(s.samples).toBe(4);
    expect(s.good).toBe(2);
    expect(s.needsImprovement).toBe(1);
    expect(s.poor).toBe(1);
    expect(s.goodRate).toBe(50);
  });

  it('normaliza rotas removendo query, hash e barra final', () => {
    expect(normalizeRoute('/categoria/eletricista?x=1')).toBe('/categoria/eletricista');
    expect(normalizeRoute('/buscar/#top')).toBe('/buscar');
    expect(normalizeRoute('/')).toBe('/');
  });

  it('agrupa por rota e ordena pelas piores primeiro', () => {
    const rows = summarizeByRoute([
      sample({ route: '/ok', value: 900 }),
      sample({ route: '/ok', value: 950 }),
      sample({ route: '/ok', value: 1000 }),
      sample({ route: '/ruim', value: 9000 }),
      sample({ route: '/ruim', value: 9500 }),
      sample({ route: '/ruim', value: 9900 }),
    ], 3);
    expect(rows[0].route).toBe('/ruim');
    expect(rows[0].worst).toBe('poor');
    expect(rows[1].worst).toBe('good');
  });

  it('descarta rotas abaixo do mínimo de amostras', () => {
    expect(summarizeByRoute([sample({ route: '/pouco' })], 3)).toHaveLength(0);
  });

  it('agrupa por dia em ordem cronológica', () => {
    const daily = summarizeDaily([
      sample({ created_at: '2026-08-14T10:00:00.000Z', value: 1000 }),
      sample({ created_at: '2026-08-13T10:00:00.000Z', value: 4000 }),
    ]);
    expect(daily.map((d) => d.day)).toEqual(['2026-08-13', '2026-08-14']);
    expect(daily[0].lcpP75).toBe(4000);
  });

  it('deriva dispositivo a partir do viewport', () => {
    expect(deviceOf('390x844')).toBe('mobile');
    expect(deviceOf('1440x900')).toBe('desktop');
    expect(deviceOf(null)).toBe('unknown');
    expect(deviceOf('abc')).toBe('unknown');
  });

  it('formata CLS sem unidade e demais em ms', () => {
    expect(formatMetric('CLS', 0.1234)).toBe('0.123');
    expect(formatMetric('LCP', 2500.6)).toBe('2501 ms');
    expect(formatMetric('INP', null)).toBe('—');
  });
});
