/**
 * Phase 1.9.34 — Sponsor Absolute Existence Plane · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_EXISTENCE_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  existencePlaneVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  functionalActivationAllowed: false,
  recalculationAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
  identityMode: 'ABSOLUTE_IMMUTABLE' as const,
});

export class SponsorExistenceMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-existence] ${message}`);
    this.name = 'SponsorExistenceMutationError';
  }
}

export class SponsorExistenceDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-existence:determinism] ${message}`);
    this.name = 'SponsorExistenceDeterminismError';
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

export type SponsorExistenceLayerId =
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
  | 'fixedPoint';

export const SPONSOR_EXISTENCE_LAYER_ORDER: ReadonlyArray<SponsorExistenceLayerId> = Object.freeze(
  [
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
  ],
);

export const SPONSOR_EXISTENCE_LAYER_PHASE: Readonly<
  Record<SponsorExistenceLayerId, string>
> = Object.freeze({
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
});

export type SponsorExistenceInvariantId =
  | 'EX-CANONICAL-ONTOLOGY-ORDERING'
  | 'EX-DETERMINISTIC-IDENTITY'
  | 'EX-LAYER-EXISTENCE-COMPLETENESS'
  | 'EX-SIGNATURE-STABILITY'
  | 'EX-ONTOLOGY-LINEAGE-INTEGRITY'
  | 'EX-ROLLBACK-IDENTITY-EQUIVALENCE'
  | 'EX-READ-ONLY-UPSTREAM'
  | 'EX-IMMUTABLE-EXISTENCE-ENVELOPE'
  | 'EX-ABSOLUTE-IDENTITY-UNIQUENESS';

export interface SponsorExistenceInvariantSpec {
  readonly id: SponsorExistenceInvariantId;
  readonly title: string;
  readonly statement: string;
}

export const SPONSOR_EXISTENCE_INVARIANTS: ReadonlyArray<SponsorExistenceInvariantSpec> =
  Object.freeze([
    Object.freeze({
      id: 'EX-ABSOLUTE-IDENTITY-UNIQUENESS',
      title: 'Absolute Identity Uniqueness',
      statement:
        'The system possesses one and only one deterministic absolute identity signature.',
    }),
    Object.freeze({
      id: 'EX-CANONICAL-ONTOLOGY-ORDERING',
      title: 'Canonical Ontology Ordering',
      statement: 'All 20 layers (1.9.14 → 1.9.33) appear in a single canonical ontology order.',
    }),
    Object.freeze({
      id: 'EX-DETERMINISTIC-IDENTITY',
      title: 'Deterministic Identity Generation',
      statement: 'Identical inputs always yield identical existence identity signatures.',
    }),
    Object.freeze({
      id: 'EX-IMMUTABLE-EXISTENCE-ENVELOPE',
      title: 'Immutable Existence Envelope',
      statement: 'The existence envelope is deeply frozen and post-lock mutation is impossible.',
    }),
    Object.freeze({
      id: 'EX-LAYER-EXISTENCE-COMPLETENESS',
      title: 'Layer Existence Completeness',
      statement: 'Every layer 1.9.14 → 1.9.33 has a registered ontology node.',
    }),
    Object.freeze({
      id: 'EX-ONTOLOGY-LINEAGE-INTEGRITY',
      title: 'Ontology Lineage Integrity',
      statement: 'The ontology lineage deterministically reconstructs the structural evolution.',
    }),
    Object.freeze({
      id: 'EX-READ-ONLY-UPSTREAM',
      title: 'Read-Only Upstream Access',
      statement: 'No upstream layer is mutated by existence synthesis.',
    }),
    Object.freeze({
      id: 'EX-ROLLBACK-IDENTITY-EQUIVALENCE',
      title: 'Rollback Identity Equivalence',
      statement: 'Rollback reproduces existence envelopes bit-identical to the original.',
    }),
    Object.freeze({
      id: 'EX-SIGNATURE-STABILITY',
      title: 'Signature Stability',
      statement: 'All existence sub-signatures remain stable across re-executions.',
    }),
  ]);
