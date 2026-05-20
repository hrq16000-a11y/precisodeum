import { deepFreeze, sigOf, cloneSorted } from './observabilityTypes';

export interface ConversionEvent {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly value: number;
}

export interface ConversionTelemetry {
  readonly bySource: ReadonlyArray<{ source: string; total: number; count: number }>;
  readonly totalValue: number;
  readonly signature: string;
}

export function buildConversionTelemetry(
  events: ReadonlyArray<ConversionEvent>,
): ConversionTelemetry {
  const acc = new Map<string, { total: number; count: number }>();
  let totalValue = 0;
  for (const e of events) {
    const cur = acc.get(e.source) ?? { total: 0, count: 0 };
    cur.total += e.value;
    cur.count += 1;
    totalValue += e.value;
    acc.set(e.source, cur);
  }
  const bySource = cloneSorted(
    Array.from(acc.entries()).map(([source, v]) => ({ source, total: v.total, count: v.count })),
    (a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0),
  );
  const out = { bySource, totalValue, signature: sigOf({ bySource, totalValue }) };
  return deepFreeze(out);
}
