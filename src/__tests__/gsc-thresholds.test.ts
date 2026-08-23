import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GSC_THRESHOLDS,
  evaluateGscThresholds,
  parseGscThresholds,
  serializeGscThresholds,
} from '@/lib/seo/gscThresholds';

describe('gscThresholds', () => {
  it('usa defaults quando o valor salvo é ausente ou corrompido', () => {
    expect(parseGscThresholds(null)).toEqual(DEFAULT_GSC_THRESHOLDS);
    expect(parseGscThresholds('{nao-json')).toEqual(DEFAULT_GSC_THRESHOLDS);
  });

  it('faz clamp de percentuais e negativos', () => {
    const t = parseGscThresholds({ minIndexedRatio: 500, minClicks: -20 });
    expect(t.minIndexedRatio).toBe(100);
    expect(t.minClicks).toBe(0);
  });

  it('serializa e reidrata sem perder valores', () => {
    const t = parseGscThresholds({ minIndexedRatio: 70, minImpressions: 250, minClicks: 9, maxSitemapErrors: 2 });
    expect(parseGscThresholds(serializeGscThresholds(t))).toEqual(t);
  });

  it('marca métrica sem dado como unknown (fail-closed, sem alerta)', () => {
    const { statuses, alerts } = evaluateGscThresholds({ indexedRatio: null });
    expect(statuses.find((s) => s.metric === 'indexed_ratio')?.status).toBe('unknown');
    expect(alerts.some((a) => a.metric === 'indexed_ratio')).toBe(false);
  });

  it('gera alerta crítico quando a indexação cai abaixo do limiar', () => {
    const { alerts } = evaluateGscThresholds({ indexedRatio: 20 }, { ...DEFAULT_GSC_THRESHOLDS, minIndexedRatio: 60 });
    const alert = alerts.find((a) => a.metric === 'indexed_ratio');
    expect(alert?.severity).toBe('critical');
    expect(alert?.message).toContain('20%');
  });

  it('alerta impressões e cliques abaixo do mínimo configurável', () => {
    const { alerts } = evaluateGscThresholds(
      { impressions: 10, clicks: 0 },
      { ...DEFAULT_GSC_THRESHOLDS, minImpressions: 100, minClicks: 5 },
    );
    expect(alerts.map((a) => a.metric).sort()).toEqual(['clicks', 'impressions']);
  });

  it('não alerta quando tudo está acima do limiar', () => {
    const { alerts } = evaluateGscThresholds({
      indexedRatio: 95,
      impressions: 5000,
      clicks: 120,
      sitemapErrors: 0,
    });
    expect(alerts).toHaveLength(0);
  });

  it('alerta sitemaps com erro acima do tolerado', () => {
    const { alerts } = evaluateGscThresholds({ sitemapErrors: 3 }, { ...DEFAULT_GSC_THRESHOLDS, maxSitemapErrors: 1 });
    expect(alerts[0].metric).toBe('sitemap_errors');
  });
});
