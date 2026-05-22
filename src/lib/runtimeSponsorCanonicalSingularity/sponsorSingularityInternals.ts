/**
 * Phase 1.9.41 — Sponsor Canonical Singularity Plane · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_SINGULARITY_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  singularityPlaneVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  functionalActivationAllowed: false,
  recalculationAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
  singularityMode: 'TERMINAL_CANONICAL_SINGULAR' as const,
});

export class SponsorSingularityMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-singularity] ${message}`);
    this.name = 'SponsorSingularityMutationError';
  }
}

export class SponsorSingularityDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-singularity:determinism] ${message}`);
    this.name = 'SponsorSingularityDeterminismError';
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

export type SponsorSingularityLayerId =
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
  | 'equilibrium'
  | 'unity'
  | 'reflexivity'
  | 'closureUnity'
  | 'omega';

export const SPONSOR_SINGULARITY_LAYER_ORDER: ReadonlyArray<SponsorSingularityLayerId> =
  Object.freeze([
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
    'unity',
    'reflexivity',
    'closureUnity',
    'omega',
  ]);

export const SPONSOR_SINGULARITY_LAYER_PHASE: Readonly<
  Record<SponsorSingularityLayerId, string>
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
  existence: '1.9.34',
  coherence: '1.9.35',
  equilibrium: '1.9.36',
  unity: '1.9.37',
  reflexivity: '1.9.38',
  closureUnity: '1.9.39',
  omega: '1.9.40',
});

export type SponsorSingularityInvariantId =
  | 'SG-CANONICAL-COLLAPSE-ORDERING'
  | 'SG-DETERMINISTIC-SINGULARITY-GENERATION'
  | 'SG-IMMUTABLE-SINGULARITY-ENVELOPE'
  | 'SG-LAYER-CANONICAL-COLLAPSE'
  | 'SG-READ-ONLY-UPSTREAM'
  | 'SG-UNIVERSAL-SINGULARITY-CLOSURE'
  | 'SG-SINGULARITY-LINEAGE-INTEGRITY'
  | 'SG-ROLLBACK-SINGULARITY-EQUIVALENCE'
  | 'SG-TERMINAL-CANONICAL-SINGULARITY-CERTIFICATION';

export interface SponsorSingularityInvariantSpec {
  readonly id: SponsorSingularityInvariantId;
  readonly title: string;
  readonly statement: string;
}

export const SPONSOR_SINGULARITY_INVARIANTS: ReadonlyArray<SponsorSingularityInvariantSpec> =
  Object.freeze([
    Object.freeze({
      id: 'SG-CANONICAL-COLLAPSE-ORDERING',
      title: 'Canonical Collapse Ordering',
      statement:
        'All 27 layers (1.9.14 → 1.9.40) collapse in a single canonical singularity order.',
    }),
    Object.freeze({
      id: 'SG-DETERMINISTIC-SINGULARITY-GENERATION',
      title: 'Deterministic Singularity Generation',
      statement: 'Identical inputs always yield identical canonical singularity envelopes.',
    }),
    Object.freeze({
      id: 'SG-IMMUTABLE-SINGULARITY-ENVELOPE',
      title: 'Immutable Singularity Envelope',
      statement:
        'The singularity envelope is deeply frozen and post-lock mutation is impossible.',
    }),
    Object.freeze({
      id: 'SG-LAYER-CANONICAL-COLLAPSE',
      title: 'Layer Canonical Collapse',
      statement:
        'Every layer 1.9.14 → 1.9.40 has a registered canonical collapse proof into the singularity.',
    }),
    Object.freeze({
      id: 'SG-READ-ONLY-UPSTREAM',
      title: 'Read-Only Upstream Access',
      statement: 'No upstream layer is mutated by singularity synthesis.',
    }),
    Object.freeze({
      id: 'SG-UNIVERSAL-SINGULARITY-CLOSURE',
      title: 'Universal Singularity Closure',
      statement:
        'Singularity closes over the entire upstream lattice into one canonical identity.',
    }),
    Object.freeze({
      id: 'SG-SINGULARITY-LINEAGE-INTEGRITY',
      title: 'Singularity Lineage Integrity',
      statement: 'The singularity lineage deterministically reconstructs the canonical collapse.',
    }),
    Object.freeze({
      id: 'SG-ROLLBACK-SINGULARITY-EQUIVALENCE',
      title: 'Rollback Singularity Equivalence',
      statement: 'Rollback reproduces singularity envelopes bit-identical to the original.',
    }),
    Object.freeze({
      id: 'SG-TERMINAL-CANONICAL-SINGULARITY-CERTIFICATION',
      title: 'Terminal Canonical Singularity Certification',
      statement:
        'The singularity terminal state certifies the absolute canonical singular identity of the system.',
    }),
  ]);
