/**
 * Phase 1.9.13 — Runtime Production Observability Graph
 * READ-ONLY · deterministic · reversible · zero side-effects.
 */

export const OBS_STAGE = 'STAGE_0_READ_ONLY' as const;

export const OBS_INTERNALS = Object.freeze({
  stage: OBS_STAGE,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});

export type ObsStage = typeof OBS_STAGE;

export type MetricKind =
  | 'counter'
  | 'gauge'
  | 'ratio'
  | 'lineage'
  | 'attribution'
  | 'conversion'
  | 'engagement'
  | 'seo'
  | 'sponsor'
  | 'funnel'
  | 'trace';

export interface MetricSample {
  readonly id: string;
  readonly kind: MetricKind;
  readonly value: number;
  readonly weight?: number;
  readonly tags?: ReadonlyArray<string>;
  readonly parents?: ReadonlyArray<string>;
}

export interface TelemetryNode {
  readonly id: string;
  readonly kind: MetricKind;
  readonly value: number;
  readonly children: ReadonlyArray<string>;
}

export interface TelemetryGraph {
  readonly nodes: ReadonlyArray<TelemetryNode>;
  readonly edges: ReadonlyArray<readonly [string, string]>;
  readonly signature: string;
}

export interface LineageEdge {
  readonly from: string;
  readonly to: string;
  readonly weight: number;
}

export interface CausalityChain {
  readonly root: string;
  readonly path: ReadonlyArray<string>;
  readonly signature: string;
}

export interface AggregatedMetric {
  readonly id: string;
  readonly kind: MetricKind;
  readonly total: number;
  readonly count: number;
  readonly mean: number;
  readonly signature: string;
}

export type ConvergenceClass =
  | 'CONVERGED'
  | 'STABLE'
  | 'OSCILLATING'
  | 'DIVERGENT'
  | 'COLLAPSED';

export interface StabilitySignal {
  readonly id: string;
  readonly convergence: ConvergenceClass;
  readonly variance: number;
  readonly signature: string;
}

export interface ObservabilityEnvelope {
  readonly stage: ObsStage;
  readonly internals: typeof OBS_INTERNALS;
  readonly graph: TelemetryGraph;
  readonly aggregates: ReadonlyArray<AggregatedMetric>;
  readonly stability: ReadonlyArray<StabilitySignal>;
  readonly signature: string;
}

export interface ObservabilityCertificate {
  readonly ok: boolean;
  readonly reasons: ReadonlyArray<string>;
  readonly signature: string;
}

export interface ObservabilityExplainer {
  readonly title: string;
  readonly bullets: ReadonlyArray<string>;
}

/* ---------------- pure helpers ---------------- */

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const v = (value as Record<string, unknown>)[key];
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return value;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ':' +
          stableStringify((value as Record<string, unknown>)[k]),
      )
      .join(',') +
    '}'
  );
}

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return ('00000000' + hash.toString(16)).slice(-8);
}

export function sigOf(value: unknown): string {
  return fnv1a(stableStringify(value));
}

export function cloneSorted<T>(arr: ReadonlyArray<T>, cmp: (a: T, b: T) => number): T[] {
  return arr.slice().sort(cmp);
}
