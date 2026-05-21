/**
 * Phase 1.9.37 — Sponsor Absolute Unity Plane · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_UNITY_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  unityPlaneVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  functionalActivationAllowed: false,
  recalculationAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
  unityMode: 'TERMINAL_SELF_EQUIVALENT' as const,
});

export class SponsorUnityMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-unity] ${message}`);
    this.name = 'SponsorUnityMutationError';
  }
}

export class SponsorUnityDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-unity:determinism] ${message}`);
    this.name = 'SponsorUnityDeterminismError';
  }
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const k of Object.keys(value as Record<string, unknown>)) {
      const child = (value as Record<string, unknown>)[k];
      if (child && typeof child === 'object') deepFreeze(child);
    }
  }
  return value;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
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

export function signObject(value: unknown): string {
  return fnv1a(stableStringify(value));
}

export type SponsorUnityLayerId =
  | 'mesh'
  | 'decision'
  | 'campaign'
  | 'temporal'
  | 'contract'
  | 'api'
  | 'surface'
  | 'consistency'
  | 'audit'
  | 'governance'
  | 'capability'
  | 'topology'
  | 'world'
  | 'replay'
  | 'verification'
  | 'manifest'
  | 'specification'
  | 'constitution'
  | 'closure'
  | 'fixedPoint'
  | 'existence'
  | 'coherence'
  | 'equilibrium';

export const SPONSOR_UNITY_LAYER_ORDER: ReadonlyArray<SponsorUnityLayerId> = Object.freeze([
  'mesh',
  'decision',
  'campaign',
  'temporal',
  'contract',
  'api',
  'surface',
  'consistency',
  'audit',
  'governance',
  'capability',
  'topology',
  'world',
  'replay',
  'verification',
  'manifest',
  'specification',
  'constitution',
  'closure',
  'fixedPoint',
  'existence',
  'coherence',
  'equilibrium',
]);

export const SPONSOR_UNITY_LAYER_PHASE: Readonly<Record<SponsorUnityLayerId, string>> =
  Object.freeze({
    mesh: '1.9.14',
    decision: '1.9.15',
    campaign: '1.9.16',
    temporal: '1.9.17',
    contract: '1.9.18',
    api: '1.9.19',
    surface: '1.9.20',
    consistency: '1.9.21',
    audit: '1.9.22',
    governance: '1.9.23',
    capability: '1.9.24',
    topology: '1.9.25',
    world: '1.9.26',
    replay: '1.9.27',
    verification: '1.9.28',
    manifest: '1.9.29',
    specification: '1.9.30',
    constitution: '1.9.31',
    closure: '1.9.32',
    fixedPoint: '1.9.33',
    existence: '1.9.34',
    coherence: '1.9.35',
    equilibrium: '1.9.36',
  });

export type SponsorUnityInvariantId =
  | 'UN-CANONICAL-EQUIVALENCE-ORDERING'
  | 'UN-DETERMINISTIC-UNITY'
  | 'UN-LAYER-SELF-EQUIVALENCE'
  | 'UN-UNIVERSAL-UNITY-CLOSURE'
  | 'UN-UNITY-LINEAGE-INTEGRITY'
  | 'UN-ROLLBACK-UNITY-EQUIVALENCE'
  | 'UN-READ-ONLY-UPSTREAM'
  | 'UN-IMMUTABLE-UNITY-ENVELOPE'
  | 'UN-TERMINAL-SELF-EQUIVALENCE-CLOSURE';

export interface SponsorUnityInvariantSpec {
  readonly id: SponsorUnityInvariantId;
  readonly title: string;
  readonly statement: string;
}

export const SPONSOR_UNITY_INVARIANTS: ReadonlyArray<SponsorUnityInvariantSpec> = Object.freeze([
  Object.freeze({
    id: 'UN-CANONICAL-EQUIVALENCE-ORDERING',
    title: 'Canonical Equivalence Ordering',
    statement:
      'All 23 layers (1.9.14 → 1.9.36) appear in a single canonical self-equivalence order.',
  }),
  Object.freeze({
    id: 'UN-DETERMINISTIC-UNITY',
    title: 'Deterministic Unity Generation',
    statement: 'Identical inputs always yield identical unity envelopes.',
  }),
  Object.freeze({
    id: 'UN-IMMUTABLE-UNITY-ENVELOPE',
    title: 'Immutable Unity Envelope',
    statement: 'The unity envelope is deeply frozen and post-lock mutation is impossible.',
  }),
  Object.freeze({
    id: 'UN-LAYER-SELF-EQUIVALENCE',
    title: 'Layer Self-Equivalence',
    statement: 'Every layer 1.9.14 → 1.9.36 has a registered self-equivalence proof.',
  }),
  Object.freeze({
    id: 'UN-READ-ONLY-UPSTREAM',
    title: 'Read-Only Upstream Access',
    statement: 'No upstream layer is mutated by unity synthesis.',
  }),
  Object.freeze({
    id: 'UN-ROLLBACK-UNITY-EQUIVALENCE',
    title: 'Rollback Unity Equivalence',
    statement: 'Rollback reproduces unity envelopes bit-identical to the original.',
  }),
  Object.freeze({
    id: 'UN-UNITY-LINEAGE-INTEGRITY',
    title: 'Unity Lineage Integrity',
    statement:
      'The unity lineage deterministically reconstructs the self-equivalence evolution.',
  }),
  Object.freeze({
    id: 'UN-TERMINAL-SELF-EQUIVALENCE-CLOSURE',
    title: 'Terminal Self-Equivalence Closure',
    statement: 'The unity terminal state closes the universal self-equivalence graph.',
  }),
  Object.freeze({
    id: 'UN-UNIVERSAL-UNITY-CLOSURE',
    title: 'Universal Unity Closure',
    statement:
      'No further interpretation or recomposition alters the system unity signature.',
  }),
]);
