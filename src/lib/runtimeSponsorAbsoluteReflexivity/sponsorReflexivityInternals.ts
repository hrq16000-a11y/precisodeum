/**
 * Phase 1.9.38 — Sponsor Absolute Reflexivity Plane · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_REFLEXIVITY_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  reflexivityPlaneVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  functionalActivationAllowed: false,
  recalculationAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
  reflexivityMode: 'TERMINAL_META_RECURSIVE' as const,
});

export class SponsorReflexivityMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-reflexivity] ${message}`);
    this.name = 'SponsorReflexivityMutationError';
  }
}

export class SponsorReflexivityDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-reflexivity:determinism] ${message}`);
    this.name = 'SponsorReflexivityDeterminismError';
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

export type SponsorReflexivityLayerId =
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
  | 'unity';

export const SPONSOR_REFLEXIVITY_LAYER_ORDER: ReadonlyArray<SponsorReflexivityLayerId> =
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
  ]);

export const SPONSOR_REFLEXIVITY_LAYER_PHASE: Readonly<
  Record<SponsorReflexivityLayerId, string>
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
});

export type SponsorReflexivityInvariantId =
  | 'RX-CANONICAL-RECURSIVE-ORDERING'
  | 'RX-DETERMINISTIC-REFLEXIVITY'
  | 'RX-LAYER-SELF-DESCRIPTION'
  | 'RX-RECURSIVE-COMPLETENESS-CLOSURE'
  | 'RX-REFLEXIVE-LINEAGE-INTEGRITY'
  | 'RX-ROLLBACK-REFLEXIVITY-EQUIVALENCE'
  | 'RX-READ-ONLY-UPSTREAM'
  | 'RX-IMMUTABLE-REFLEXIVITY-ENVELOPE'
  | 'RX-TERMINAL-META-RECURSIVE-CLOSURE';

export interface SponsorReflexivityInvariantSpec {
  readonly id: SponsorReflexivityInvariantId;
  readonly title: string;
  readonly statement: string;
}

export const SPONSOR_REFLEXIVITY_INVARIANTS: ReadonlyArray<SponsorReflexivityInvariantSpec> =
  Object.freeze([
    Object.freeze({
      id: 'RX-CANONICAL-RECURSIVE-ORDERING',
      title: 'Canonical Recursive Ordering',
      statement:
        'All 24 layers (1.9.14 → 1.9.37) appear in a single canonical recursive description order.',
    }),
    Object.freeze({
      id: 'RX-DETERMINISTIC-REFLEXIVITY',
      title: 'Deterministic Reflexivity Generation',
      statement: 'Identical inputs always yield identical reflexivity envelopes.',
    }),
    Object.freeze({
      id: 'RX-IMMUTABLE-REFLEXIVITY-ENVELOPE',
      title: 'Immutable Reflexivity Envelope',
      statement: 'The reflexivity envelope is deeply frozen and post-lock mutation is impossible.',
    }),
    Object.freeze({
      id: 'RX-LAYER-SELF-DESCRIPTION',
      title: 'Layer Self-Description',
      statement: 'Every layer 1.9.14 → 1.9.37 has a registered recursive self-description proof.',
    }),
    Object.freeze({
      id: 'RX-READ-ONLY-UPSTREAM',
      title: 'Read-Only Upstream Access',
      statement: 'No upstream layer is mutated by reflexivity synthesis.',
    }),
    Object.freeze({
      id: 'RX-RECURSIVE-COMPLETENESS-CLOSURE',
      title: 'Recursive Completeness Closure',
      statement: 'Reflexive completeness closes over the entire upstream lattice without remainder.',
    }),
    Object.freeze({
      id: 'RX-REFLEXIVE-LINEAGE-INTEGRITY',
      title: 'Reflexive Lineage Integrity',
      statement: 'The reflexive lineage deterministically reconstructs self-description evolution.',
    }),
    Object.freeze({
      id: 'RX-ROLLBACK-REFLEXIVITY-EQUIVALENCE',
      title: 'Rollback Reflexivity Equivalence',
      statement: 'Rollback reproduces reflexivity envelopes bit-identical to the original.',
    }),
    Object.freeze({
      id: 'RX-TERMINAL-META-RECURSIVE-CLOSURE',
      title: 'Terminal Meta-Recursive Closure',
      statement: 'The reflexivity terminal state closes the universal meta-recursive graph.',
    }),
  ]);
