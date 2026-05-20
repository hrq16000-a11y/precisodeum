// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Transformation builder
// Pure, deterministic, read-only. No runtime/IO/imports outside types.

import type {
  MetaClass,
  MetaComponent,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';

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

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 1e6) / 1e6;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}';
}

function hashSignature(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return 'meta_' + h.toString(16).padStart(8, '0');
}

function canonicalizeComponent(c: MetaComponent): MetaComponent {
  const morphisms = [...c.morphisms].sort();
  const canonical: MetaComponent = {
    id: c.id,
    layer: c.layer,
    stage: STAGE_0,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    naturality: clamp01(c.naturality),
    functoriality: clamp01(c.functoriality),
    identity: clamp01(c.identity),
    determinism: clamp01(c.determinism),
    stability: clamp01(c.stability),
    lift: clamp01(c.lift),
    fixedPoint: clamp01(c.fixedPoint),
    morphisms,
    signature: hashSignature(c.id + '|' + c.layer + '|' + morphisms.join(',')),
  };
  return deepFreeze(canonical);
}

function classify(score: number, broken: number, components: number): MetaClass {
  if (components === 0) return 'DEGENERATE';
  if (broken > 0 && score < 0.4) return 'BROKEN';
  if (score >= 0.85 && broken === 0) return 'META';
  if (score >= 0.65) return 'WEAKLY_META';
  if (score >= 0.4) return 'PARTIAL';
  return 'BROKEN';
}

export function buildMetaTransformation(
  components: readonly MetaComponent[],
): RuntimeMetaTransformation {
  const canonical = components
    .map(canonicalizeComponent)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let total = 0;
  let broken = 0;
  for (const c of canonical) {
    const s = (c.naturality + c.functoriality + c.identity + c.determinism + c.stability + c.lift + c.fixedPoint) / 7;
    total += s;
    if (s < 0.35) broken++;
  }
  const score = canonical.length === 0 ? 0 : clamp01(total / canonical.length);
  const klass = classify(score, broken, canonical.length);
  const collapsed = klass === 'BROKEN' || klass === 'DEGENERATE';
  const signature = hashSignature(stableStringify({ k: klass, s: score, c: canonical.map((x) => x.signature) }));

  const envelope: RuntimeMetaTransformation = {
    components: canonical,
    class: klass,
    score,
    collapsed,
    signature,
  };
  return deepFreeze(envelope);
}

export const __meta_transformation_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
  deepFreeze,
  clamp01,
  stableStringify,
  hashSignature,
});
