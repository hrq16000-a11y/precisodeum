// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Normalization
// Pure, deterministic canonical form. Read-only. No side-effects.

import type {
  RuntimeMetaTransformation,
  MetaComponent,
} from './metaTransformationTypes';
import { buildMetaTransformation } from './metaTransformation';

const STAGE_0 = 'STAGE_0_READ_ONLY' as const;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

function normalizeComponent(c: MetaComponent): MetaComponent {
  const morphisms = [...c.morphisms]
    .map((m) => String(m))
    .filter((m, i, arr) => arr.indexOf(m) === i)
    .sort();
  const round = (n: number): number => {
    if (!Number.isFinite(n)) return 0;
    const x = n < 0 ? 0 : n > 1 ? 1 : n;
    return Math.round(x * 1e6) / 1e6;
  };
  const out: MetaComponent = {
    id: c.id,
    layer: c.layer,
    stage: STAGE_0,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    naturality: round(c.naturality),
    functoriality: round(c.functoriality),
    identity: round(c.identity),
    determinism: round(c.determinism),
    stability: round(c.stability),
    lift: round(c.lift),
    fixedPoint: round(c.fixedPoint),
    morphisms,
    signature: c.signature,
  };
  return deepFreeze(out);
}

function dedupeAndSort(components: readonly MetaComponent[]): readonly MetaComponent[] {
  const seen = new Map<string, MetaComponent>();
  for (const c of components) {
    const n = normalizeComponent(c);
    const key = n.id + '|' + n.layer;
    if (!seen.has(key)) seen.set(key, n);
  }
  return Object.freeze(
    Array.from(seen.values()).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  );
}

export function normalizeMetaTransformation(
  t: RuntimeMetaTransformation,
): RuntimeMetaTransformation {
  const components = dedupeAndSort(t.components);
  // Rebuild via canonical builder to recompute score/signature/class.
  return buildMetaTransformation(components);
}

export function stableNormalizeMetaTransformation(
  t: RuntimeMetaTransformation,
): RuntimeMetaTransformation {
  // Idempotent: normalizing twice must equal normalizing once.
  const first = normalizeMetaTransformation(t);
  const second = normalizeMetaTransformation(first);
  return second;
}

export function isMetaNormalizationIdempotent(t: RuntimeMetaTransformation): boolean {
  const a = normalizeMetaTransformation(t);
  const b = normalizeMetaTransformation(a);
  return a.signature === b.signature && a.score === b.score && a.class === b.class;
}

export const __meta_normalization_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});
