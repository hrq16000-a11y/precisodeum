/**
 * Phase 1.9.31 — Sponsor System Constitution Plane · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_CONSTITUTION_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  constitutionPlaneVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  functionalActivationAllowed: false,
  recalculationAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
});

export class SponsorConstitutionMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-constitution] ${message}`);
    this.name = 'SponsorConstitutionMutationError';
  }
}

export class SponsorConstitutionDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-constitution:determinism] ${message}`);
    this.name = 'SponsorConstitutionDeterminismError';
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

export type SponsorConstitutionLayerId =
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
  | 'specification';

export interface SponsorConstitutionLayerSpec {
  readonly layer: SponsorConstitutionLayerId;
  readonly phase: string;
}

export const SPONSOR_CONSTITUTION_LAYERS: ReadonlyArray<SponsorConstitutionLayerSpec> =
  Object.freeze([
    { layer: 'mesh',          phase: '1.9.14' },
    { layer: 'decision',      phase: '1.9.15' },
    { layer: 'campaign',      phase: '1.9.16' },
    { layer: 'temporal',      phase: '1.9.17' },
    { layer: 'contract',      phase: '1.9.18' },
    { layer: 'api',           phase: '1.9.19' },
    { layer: 'surface',       phase: '1.9.20' },
    { layer: 'consistency',   phase: '1.9.21' },
    { layer: 'audit',         phase: '1.9.22' },
    { layer: 'governance',    phase: '1.9.23' },
    { layer: 'capability',    phase: '1.9.24' },
    { layer: 'topology',      phase: '1.9.25' },
    { layer: 'world',         phase: '1.9.26' },
    { layer: 'replay',        phase: '1.9.27' },
    { layer: 'verification',  phase: '1.9.28' },
    { layer: 'manifest',      phase: '1.9.29' },
    { layer: 'specification', phase: '1.9.30' },
  ]);

export const SPONSOR_CONSTITUTION_LAYER_ORDER: ReadonlyArray<SponsorConstitutionLayerId> =
  Object.freeze(SPONSOR_CONSTITUTION_LAYERS.map((l) => l.layer));

export type SponsorConstitutionalAxiomId =
  | 'AX-DETERMINISM'
  | 'AX-READ-ONLY-UPSTREAM'
  | 'AX-IMMUTABLE-ENVELOPES'
  | 'AX-CANONICAL-ORDERING'
  | 'AX-ROLLBACK-REPRODUCIBILITY'
  | 'AX-ZERO-FUNCTIONAL-ACTIVATION'
  | 'AX-ZERO-EXTERNAL-RUNTIME'
  | 'AX-LINEAGE-CONTINUITY';

export interface SponsorConstitutionalAxiomSpec {
  readonly id: SponsorConstitutionalAxiomId;
  readonly title: string;
  readonly statement: string;
}

export const SPONSOR_CONSTITUTIONAL_AXIOMS: ReadonlyArray<SponsorConstitutionalAxiomSpec> =
  Object.freeze([
    { id: 'AX-DETERMINISM',                title: 'Determinism',                 statement: 'identical inputs MUST produce bit-identical outputs across all layers' },
    { id: 'AX-READ-ONLY-UPSTREAM',         title: 'Read-Only Upstream',          statement: 'meta layers MUST NOT mutate any upstream layer' },
    { id: 'AX-IMMUTABLE-ENVELOPES',        title: 'Immutable Envelopes',         statement: 'every layer envelope MUST be deeply frozen and locked' },
    { id: 'AX-CANONICAL-ORDERING',         title: 'Canonical Ordering',          statement: 'every registry / graph MUST emit elements in canonical order' },
    { id: 'AX-ROLLBACK-REPRODUCIBILITY',   title: 'Rollback Reproducibility',    statement: 're-execution MUST yield identical signatures and envelopes' },
    { id: 'AX-ZERO-FUNCTIONAL-ACTIVATION', title: 'Zero Functional Activation',  statement: 'no meta layer MAY activate or change business behavior' },
    { id: 'AX-ZERO-EXTERNAL-RUNTIME',      title: 'Zero External Runtime',       statement: 'no meta layer MAY depend on any external runtime' },
    { id: 'AX-LINEAGE-CONTINUITY',         title: 'Lineage Continuity',          statement: 'every layer MUST be representable in a cumulative signed lineage' },
  ]);

export type SponsorSupremeInvariantId =
  | 'INV-LAYER-COMPLETENESS'
  | 'INV-SIGNATURE-INTEGRITY'
  | 'INV-NO-UPSTREAM-MUTATION'
  | 'INV-ENVELOPE-FREEZE'
  | 'INV-LINEAGE-CHAIN'
  | 'INV-DETERMINISTIC-REPLAY';

export interface SponsorSupremeInvariantSpec {
  readonly id: SponsorSupremeInvariantId;
  readonly axiom: SponsorConstitutionalAxiomId;
  readonly description: string;
}

export const SPONSOR_SUPREME_INVARIANTS: ReadonlyArray<SponsorSupremeInvariantSpec> = Object.freeze([
  { id: 'INV-LAYER-COMPLETENESS',   axiom: 'AX-CANONICAL-ORDERING',       description: 'all 17 layers MUST be present in canonical order' },
  { id: 'INV-SIGNATURE-INTEGRITY',  axiom: 'AX-DETERMINISM',              description: 'every layer MUST expose a stable, non-empty signature' },
  { id: 'INV-NO-UPSTREAM-MUTATION', axiom: 'AX-READ-ONLY-UPSTREAM',       description: 'no upstream layer signature MAY change due to meta layers' },
  { id: 'INV-ENVELOPE-FREEZE',      axiom: 'AX-IMMUTABLE-ENVELOPES',      description: 'every envelope MUST be deeply frozen and locked' },
  { id: 'INV-LINEAGE-CHAIN',        axiom: 'AX-LINEAGE-CONTINUITY',       description: 'lineage MUST form a cumulative signed chain across descriptors' },
  { id: 'INV-DETERMINISTIC-REPLAY', axiom: 'AX-ROLLBACK-REPRODUCIBILITY', description: 'replay over identical inputs MUST reproduce identical envelopes' },
]);
