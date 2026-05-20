import { deepFreeze, sigOf, cloneSorted } from './observabilityTypes';

export interface FunnelStep {
  readonly step: string;
  readonly order: number;
  readonly count: number;
}

export interface FunnelTopology {
  readonly steps: ReadonlyArray<{
    step: string;
    order: number;
    count: number;
    conversionFromPrev: number;
  }>;
  readonly overallConversion: number;
  readonly signature: string;
}

export function buildFunnelTopology(steps: ReadonlyArray<FunnelStep>): FunnelTopology {
  const sorted = cloneSorted(steps.slice(), (a, b) => a.order - b.order);
  const out: Array<{ step: string; order: number; count: number; conversionFromPrev: number }> = [];
  let prev = 0;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const conv = i === 0 ? 1 : prev > 0 ? s.count / prev : 0;
    out.push({ step: s.step, order: s.order, count: s.count, conversionFromPrev: conv });
    prev = s.count;
  }
  const overall =
    sorted.length > 0 && sorted[0].count > 0
      ? sorted[sorted.length - 1].count / sorted[0].count
      : 0;
  const result = { steps: out, overallConversion: overall, signature: sigOf({ steps: out, overall }) };
  return deepFreeze(result);
}
