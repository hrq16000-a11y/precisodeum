// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Adapters
// Pure, inert, read-only adapters. Snapshot via deep clone + deepFreeze.

import type {
  MetaCertification,
  MetaComponent,
  RuntimeMetaAggregate,
  RuntimeMetaEnvelope,
  RuntimeMetaStability,
  RuntimeMetaTopology,
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

function cloneReadonly<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => cloneReadonly(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    out[k] = cloneReadonly((value as Record<string, unknown>)[k]);
  }
  return out as unknown as T;
}

function enforceComponentInvariants(c: MetaComponent): MetaComponent {
  const out: MetaComponent = {
    ...c,
    stage: STAGE_0,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    morphisms: Object.freeze([...c.morphisms].sort()),
  };
  return out;
}

export function adaptMetaTransformation(t: RuntimeMetaTransformation): RuntimeMetaTransformation {
  const components = t.components.map(enforceComponentInvariants).map((c) => cloneReadonly(c));
  const sorted = components.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const snapshot: RuntimeMetaTransformation = {
    components: Object.freeze(sorted),
    class: t.class,
    score: t.score,
    collapsed: t.collapsed,
    signature: t.signature,
  };
  return deepFreeze(snapshot);
}

export function adaptMetaTopology(topo: RuntimeMetaTopology): RuntimeMetaTopology {
  return deepFreeze(cloneReadonly(topo));
}

export function adaptMetaStability(stab: RuntimeMetaStability): RuntimeMetaStability {
  return deepFreeze(cloneReadonly(stab));
}

export function adaptMetaCertification(cert: MetaCertification): MetaCertification {
  const snapshot: MetaCertification = {
    safe: cert.safe,
    confidence: cert.confidence,
    rank: cert.rank,
    reasons: Object.freeze([...cert.reasons].sort()),
  };
  return deepFreeze(snapshot);
}

export function adaptMetaEnvelope(env: RuntimeMetaEnvelope): RuntimeMetaEnvelope {
  const snapshot: RuntimeMetaEnvelope = {
    id: env.id,
    transformation: adaptMetaTransformation(env.transformation),
    composition: deepFreeze(cloneReadonly(env.composition)),
    identity: deepFreeze(cloneReadonly(env.identity)),
    normalization: deepFreeze(cloneReadonly(env.normalization)),
    determinism: deepFreeze(cloneReadonly(env.determinism)),
    equivalence: deepFreeze(cloneReadonly(env.equivalence)),
    reduction: deepFreeze(cloneReadonly(env.reduction)),
    topology: adaptMetaTopology(env.topology),
    stability: adaptMetaStability(env.stability),
    naturality: deepFreeze(cloneReadonly(env.naturality)),
    functoriality: deepFreeze(cloneReadonly(env.functoriality)),
    lifting: deepFreeze(cloneReadonly(env.lifting)),
    fixedPoint: deepFreeze(cloneReadonly(env.fixedPoint)),
    certification: adaptMetaCertification(env.certification),
    risks: Object.freeze(
      env.risks
        .map((r) => deepFreeze({ code: r.code, severity: r.severity, description: r.description }))
        .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)),
    ),
    score: env.score,
    stable: env.stable,
  };
  return deepFreeze(snapshot);
}

export function adaptMetaAggregate(agg: RuntimeMetaAggregate): RuntimeMetaAggregate {
  const envelopes = agg.envelopes
    .map(adaptMetaEnvelope)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const snapshot: RuntimeMetaAggregate = {
    envelopes: Object.freeze(envelopes),
    score: agg.score,
    confidence: agg.confidence,
    worstSeverity: agg.worstSeverity,
    worstMeta: agg.worstMeta,
    worstComposition: agg.worstComposition,
    worstIdentity: agg.worstIdentity,
    worstDeterminism: agg.worstDeterminism,
    worstTopology: agg.worstTopology,
    worstNaturality: agg.worstNaturality,
    worstFunctoriality: agg.worstFunctoriality,
    worstLifting: agg.worstLifting,
    worstFixedPoint: agg.worstFixedPoint,
    stable: agg.stable,
    risks: Object.freeze(
      agg.risks
        .map((r) => deepFreeze({ code: r.code, severity: r.severity, description: r.description }))
        .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)),
    ),
  };
  return deepFreeze(snapshot);
}

export const __meta_adapters_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});
