/**
 * Phase 1.9.36 — Sponsor Universal Equilibrium Plane · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_EQUILIBRIUM_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  equilibriumPlaneVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  functionalActivationAllowed: false,
  recalculationAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
  equilibriumMode: 'TERMINAL_SATURATED' as const,
});

export class SponsorEquilibriumMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-equilibrium] ${message}`);
    this.name = 'SponsorEquilibriumMutationError';
  }
}

export class SponsorEquilibriumDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-equilibrium:determinism] ${message}`);
    this.name = 'SponsorEquilibriumDeterminismError';
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

export type SponsorEquilibriumLayerId =
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
  | 'coherence';

export const SPONSOR_EQUILIBRIUM_LAYER_ORDER: ReadonlyArray<SponsorEquilibriumLayerId> =
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
  ]);

export const SPONSOR_EQUILIBRIUM_LAYER_PHASE: Readonly<
  Record<SponsorEquilibriumLayerId, string>
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
});

export type SponsorEquilibriumInvariantId =
  | 'EQ-CANONICAL-SATURATION-ORDERING'
  | 'EQ-DETERMINISTIC-EQUILIBRIUM'
  | 'EQ-LAYER-SATURATION'
  | 'EQ-UNIVERSAL-EQUILIBRIUM-CLOSURE'
  | 'EQ-SATURATION-LINEAGE-INTEGRITY'
  | 'EQ-ROLLBACK-EQUILIBRIUM-EQUIVALENCE'
  | 'EQ-READ-ONLY-UPSTREAM'
  | 'EQ-IMMUTABLE-EQUILIBRIUM-ENVELOPE'
  | 'EQ-TERMINAL-SATURATION-CLOSURE';

export interface SponsorEquilibriumInvariantSpec {
  readonly id: SponsorEquilibriumInvariantId;
  readonly title: string;
  readonly statement: string;
}

export const SPONSOR_EQUILIBRIUM_INVARIANTS: ReadonlyArray<SponsorEquilibriumInvariantSpec> =
  Object.freeze([
    Object.freeze({
      id: 'EQ-CANONICAL-SATURATION-ORDERING',
      title: 'Canonical Saturation Ordering',
      statement:
        'All 22 layers (1.9.14 → 1.9.35) appear in a single canonical saturation order.',
    }),
    Object.freeze({
      id: 'EQ-DETERMINISTIC-EQUILIBRIUM',
      title: 'Deterministic Equilibrium Generation',
      statement: 'Identical inputs always yield identical equilibrium envelopes.',
    }),
    Object.freeze({
      id: 'EQ-IMMUTABLE-EQUILIBRIUM-ENVELOPE',
      title: 'Immutable Equilibrium Envelope',
      statement:
        'The equilibrium envelope is deeply frozen and post-lock mutation is impossible.',
    }),
    Object.freeze({
      id: 'EQ-LAYER-SATURATION',
      title: 'Layer Saturation',
      statement: 'Every layer 1.9.14 → 1.9.35 has a registered universal saturation proof.',
    }),
    Object.freeze({
      id: 'EQ-READ-ONLY-UPSTREAM',
      title: 'Read-Only Upstream Access',
      statement: 'No upstream layer is mutated by equilibrium synthesis.',
    }),
    Object.freeze({
      id: 'EQ-ROLLBACK-EQUILIBRIUM-EQUIVALENCE',
      title: 'Rollback Equilibrium Equivalence',
      statement: 'Rollback reproduces equilibrium envelopes bit-identical to the original.',
    }),
    Object.freeze({
      id: 'EQ-SATURATION-LINEAGE-INTEGRITY',
      title: 'Saturation Lineage Integrity',
      statement:
        'The saturation lineage deterministically reconstructs the equilibrium evolution.',
    }),
    Object.freeze({
      id: 'EQ-TERMINAL-SATURATION-CLOSURE',
      title: 'Terminal Saturation Closure',
      statement: 'The equilibrium terminal state closes the universal saturation graph.',
    }),
    Object.freeze({
      id: 'EQ-UNIVERSAL-EQUILIBRIUM-CLOSURE',
      title: 'Universal Equilibrium Closure',
      statement:
        'No further interpretation or recomposition alters the system equilibrium signature.',
    }),
  ]);
