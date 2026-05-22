/**
 * Phase 1.9.40 — Sponsor Omega Terminal Plane · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_OMEGA_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  omegaPlaneVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  functionalActivationAllowed: false,
  recalculationAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
  omegaMode: 'TERMINAL_IRREDUCIBLE' as const,
});

export class SponsorOmegaMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-omega] ${message}`);
    this.name = 'SponsorOmegaMutationError';
  }
}

export class SponsorOmegaDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-omega:determinism] ${message}`);
    this.name = 'SponsorOmegaDeterminismError';
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

export type SponsorOmegaLayerId =
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
  | 'closureUnity';

export const SPONSOR_OMEGA_LAYER_ORDER: ReadonlyArray<SponsorOmegaLayerId> = Object.freeze([
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
]);

export const SPONSOR_OMEGA_LAYER_PHASE: Readonly<Record<SponsorOmegaLayerId, string>> =
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
    unity: '1.9.37',
    reflexivity: '1.9.38',
    closureUnity: '1.9.39',
  });

export type SponsorOmegaInvariantId =
  | 'OM-CANONICAL-IRREDUCIBILITY-ORDERING'
  | 'OM-DETERMINISTIC-OMEGA-GENERATION'
  | 'OM-IMMUTABLE-OMEGA-ENVELOPE'
  | 'OM-LAYER-IRREDUCIBLE-COMPLETENESS'
  | 'OM-READ-ONLY-UPSTREAM'
  | 'OM-UNIVERSAL-IRREDUCIBLE-CLOSURE'
  | 'OM-OMEGA-LINEAGE-INTEGRITY'
  | 'OM-ROLLBACK-OMEGA-EQUIVALENCE'
  | 'OM-TERMINAL-IRREDUCIBLE-CERTIFICATION';

export interface SponsorOmegaInvariantSpec {
  readonly id: SponsorOmegaInvariantId;
  readonly title: string;
  readonly statement: string;
}

export const SPONSOR_OMEGA_INVARIANTS: ReadonlyArray<SponsorOmegaInvariantSpec> = Object.freeze([
  Object.freeze({
    id: 'OM-CANONICAL-IRREDUCIBILITY-ORDERING',
    title: 'Canonical Irreducibility Ordering',
    statement:
      'All 26 layers (1.9.14 → 1.9.39) appear in a single canonical irreducibility order.',
  }),
  Object.freeze({
    id: 'OM-DETERMINISTIC-OMEGA-GENERATION',
    title: 'Deterministic Omega Generation',
    statement: 'Identical inputs always yield identical omega terminal envelopes.',
  }),
  Object.freeze({
    id: 'OM-IMMUTABLE-OMEGA-ENVELOPE',
    title: 'Immutable Omega Envelope',
    statement: 'The omega envelope is deeply frozen and post-lock mutation is impossible.',
  }),
  Object.freeze({
    id: 'OM-LAYER-IRREDUCIBLE-COMPLETENESS',
    title: 'Layer Irreducible Completeness',
    statement: 'Every layer 1.9.14 → 1.9.39 has a registered irreducible completeness proof.',
  }),
  Object.freeze({
    id: 'OM-READ-ONLY-UPSTREAM',
    title: 'Read-Only Upstream Access',
    statement: 'No upstream layer is mutated by omega synthesis.',
  }),
  Object.freeze({
    id: 'OM-UNIVERSAL-IRREDUCIBLE-CLOSURE',
    title: 'Universal Irreducible Closure',
    statement:
      'Irreducibility closes over the entire upstream lattice without external dependency.',
  }),
  Object.freeze({
    id: 'OM-OMEGA-LINEAGE-INTEGRITY',
    title: 'Omega Lineage Integrity',
    statement: 'The omega lineage deterministically reconstructs the terminal evolution.',
  }),
  Object.freeze({
    id: 'OM-ROLLBACK-OMEGA-EQUIVALENCE',
    title: 'Rollback Omega Equivalence',
    statement: 'Rollback reproduces omega envelopes bit-identical to the original.',
  }),
  Object.freeze({
    id: 'OM-TERMINAL-IRREDUCIBLE-CERTIFICATION',
    title: 'Terminal Irreducible Certification',
    statement:
      'The omega terminal state certifies absolute irreducible completeness of the system.',
  }),
]);
