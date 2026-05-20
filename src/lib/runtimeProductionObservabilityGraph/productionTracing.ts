import { deepFreeze, sigOf, cloneSorted } from './observabilityTypes';

export interface TraceSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly opName: string;
  readonly durationMs: number;
}

export interface ProductionTrace {
  readonly traces: ReadonlyArray<{
    traceId: string;
    spans: ReadonlyArray<TraceSpan>;
    totalDuration: number;
  }>;
  readonly signature: string;
}

export function buildProductionTrace(spans: ReadonlyArray<TraceSpan>): ProductionTrace {
  const grouped = new Map<string, TraceSpan[]>();
  for (const s of spans) {
    if (!grouped.has(s.traceId)) grouped.set(s.traceId, []);
    grouped.get(s.traceId)!.push(s);
  }
  const traces = cloneSorted(
    Array.from(grouped.entries()).map(([traceId, arr]) => {
      const sortedSpans = cloneSorted(arr, (a, b) =>
        a.spanId < b.spanId ? -1 : a.spanId > b.spanId ? 1 : 0,
      );
      const total = sortedSpans.reduce(
        (acc, s) => acc + (Number.isFinite(s.durationMs) ? Math.max(0, s.durationMs) : 0),
        0,
      );
      return { traceId, spans: sortedSpans, totalDuration: total };
    }),
    (a, b) => (a.traceId < b.traceId ? -1 : a.traceId > b.traceId ? 1 : 0),
  );
  const out = { traces, signature: sigOf(traces) };
  return deepFreeze(out);
}
