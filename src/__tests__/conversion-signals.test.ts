import { describe, it, expect } from 'vitest';
import {
  bucketize,
  getProviderConversionScore,
  applyDiversityCap,
  BUCKET_MULTIPLIER,
  MIN_VIEWS_FOR_BUCKET,
  type ProviderConversionStats,
} from '@/lib/conversionSignals';

const mk = (overrides: Partial<ProviderConversionStats> = {}): ProviderConversionStats => ({
  provider_id: 'p1',
  profile_views: 0,
  whatsapp_clicks: 0,
  phone_clicks: 0,
  lead_submits: 0,
  ctr_view_to_contact: 0,
  lead_rate: 0,
  ...overrides,
});

describe('conversionSignals.bucketize', () => {
  it('unknown quando views < mínimo', () => {
    expect(bucketize(mk({ profile_views: MIN_VIEWS_FOR_BUCKET - 1, lead_rate: 0.5 }))).toBe('unknown');
  });
  it('high_conversion por lead_rate≥5%', () => {
    expect(bucketize(mk({ profile_views: 100, lead_rate: 0.06 }))).toBe('high_conversion');
  });
  it('high_conversion por CTR≥20%', () => {
    expect(bucketize(mk({ profile_views: 50, ctr_view_to_contact: 0.25 }))).toBe('high_conversion');
  });
  it('medium_conversion por CTR≥10%', () => {
    expect(bucketize(mk({ profile_views: 30, ctr_view_to_contact: 0.12 }))).toBe('medium_conversion');
  });
  it('low_conversion quando há volume mas pouca conversão', () => {
    expect(bucketize(mk({ profile_views: 50, ctr_view_to_contact: 0.01 }))).toBe('low_conversion');
  });
});

describe('conversionSignals.getProviderConversionScore', () => {
  it('zero quando sem stats e sem sponsor', () => {
    expect(getProviderConversionScore({})).toBe(0);
  });
  it('aplica bônus sponsor mesmo sem stats', () => {
    expect(getProviderConversionScore({ hasActiveSponsor: true })).toBeGreaterThan(0);
  });
  it('clamp em 50 para evitar dominância', () => {
    const score = getProviderConversionScore({
      stats: mk({ profile_views: 1000, lead_rate: 1, ctr_view_to_contact: 1, whatsapp_clicks: 100 }),
      hasActiveSponsor: true,
      isPremium: true,
    });
    expect(score).toBeLessThanOrEqual(50);
  });
  it('high > low determinístico', () => {
    const hi = getProviderConversionScore({ stats: mk({ profile_views: 100, lead_rate: 0.08, ctr_view_to_contact: 0.25 }) });
    const lo = getProviderConversionScore({ stats: mk({ profile_views: 100, lead_rate: 0.001, ctr_view_to_contact: 0.01 }) });
    expect(hi).toBeGreaterThan(lo);
  });
});

describe('BUCKET_MULTIPLIER', () => {
  it('multiplicador é leve e ordenado', () => {
    expect(BUCKET_MULTIPLIER.high_conversion).toBeGreaterThan(BUCKET_MULTIPLIER.medium_conversion);
    expect(BUCKET_MULTIPLIER.medium_conversion).toBeGreaterThan(BUCKET_MULTIPLIER.unknown);
    expect(BUCKET_MULTIPLIER.unknown).toBeGreaterThan(BUCKET_MULTIPLIER.low_conversion);
    // Limites leves: nada acima de ±20%
    Object.values(BUCKET_MULTIPLIER).forEach((m) => {
      expect(m).toBeGreaterThan(0.8);
      expect(m).toBeLessThan(1.2);
    });
  });
});

describe('applyDiversityCap', () => {
  it('não reordena lista pequena', () => {
    const list = [{ providerId: 'a' }, { providerId: 'b' }];
    expect(applyDiversityCap(list)).toEqual(list);
  });
  it('quebra streak do mesmo provider', () => {
    const list = [
      { providerId: 'a' }, { providerId: 'a' }, { providerId: 'a' },
      { providerId: 'b' }, { providerId: 'c' },
    ];
    const out = applyDiversityCap(list, 2);
    // Garante que 'a' não aparece 3x consecutivos
    let streak = 0; let last = '';
    for (const it of out) {
      if (it.providerId === last) streak++;
      else { last = it.providerId!; streak = 1; }
      expect(streak).toBeLessThanOrEqual(2);
    }
    expect(out.length).toBe(list.length);
  });
});
