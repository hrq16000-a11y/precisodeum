import { deepFreeze, sigOf, cloneSorted } from './observabilityTypes';

export interface SeoEntity {
  readonly slug: string;
  readonly impressions: number;
  readonly clicks: number;
}

export interface SeoTelemetry {
  readonly entries: ReadonlyArray<{ slug: string; impressions: number; clicks: number; ctr: number }>;
  readonly totalImpressions: number;
  readonly totalClicks: number;
  readonly signature: string;
}

export function buildSeoTelemetry(entities: ReadonlyArray<SeoEntity>): SeoTelemetry {
  let imp = 0;
  let clk = 0;
  const entries = cloneSorted(
    entities.map((e) => {
      imp += e.impressions;
      clk += e.clicks;
      return {
        slug: e.slug,
        impressions: e.impressions,
        clicks: e.clicks,
        ctr: e.impressions > 0 ? e.clicks / e.impressions : 0,
      };
    }),
    (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );
  const out = {
    entries,
    totalImpressions: imp,
    totalClicks: clk,
    signature: sigOf({ entries, imp, clk }),
  };
  return deepFreeze(out);
}
