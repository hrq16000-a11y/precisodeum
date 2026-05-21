/**
 * Phase 1.9.29 — Sponsor System Manifest Plane · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_MANIFEST_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  manifestPlaneVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  functionalActivationAllowed: false,
  recalculationAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
});

export class SponsorManifestMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-manifest] ${message}`);
    this.name = 'SponsorManifestMutationError';
  }
}

export class SponsorManifestDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-manifest:determinism] ${message}`);
    this.name = 'SponsorManifestDeterminismError';
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

export type SponsorManifestLayerId =
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
  | 'verification';

export type SponsorManifestPlane =
  | 'engine'
  | 'distribution'
  | 'observability'
  | 'control'
  | 'composition'
  | 'introspection';

export interface SponsorManifestLayerSpec {
  readonly layer: SponsorManifestLayerId;
  readonly phase: string;
  readonly plane: SponsorManifestPlane;
  readonly description: string;
}

export const SPONSOR_MANIFEST_LAYERS: ReadonlyArray<SponsorManifestLayerSpec> = Object.freeze([
  { layer: 'mesh',         phase: '1.9.14', plane: 'engine',        description: 'sponsor mesh (deterministic core engine)' },
  { layer: 'decision',     phase: '1.9.15', plane: 'engine',        description: 'decision finalizer (single commit point)' },
  { layer: 'campaign',     phase: '1.9.16', plane: 'engine',        description: 'campaign abstraction (domain model)' },
  { layer: 'temporal',     phase: '1.9.17', plane: 'engine',        description: 'temporal evolution (deterministic simulation)' },
  { layer: 'contract',     phase: '1.9.18', plane: 'control',       description: 'consumption contract' },
  { layer: 'api',          phase: '1.9.19', plane: 'control',       description: 'API product integration' },
  { layer: 'surface',      phase: '1.9.20', plane: 'distribution',  description: 'product surface stabilization' },
  { layer: 'consistency',  phase: '1.9.21', plane: 'distribution',  description: 'distributed consistency orchestrator' },
  { layer: 'audit',        phase: '1.9.22', plane: 'observability', description: 'global audit ledger' },
  { layer: 'governance',   phase: '1.9.23', plane: 'control',       description: 'policy governance' },
  { layer: 'capability',   phase: '1.9.24', plane: 'control',       description: 'capability orchestration' },
  { layer: 'topology',     phase: '1.9.25', plane: 'composition',   description: 'system topology synthesis' },
  { layer: 'world',        phase: '1.9.26', plane: 'composition',   description: 'unified world state' },
  { layer: 'replay',       phase: '1.9.27', plane: 'introspection', description: 'deterministic replay plane' },
  { layer: 'verification', phase: '1.9.28', plane: 'introspection', description: 'formal verification plane' },
]);

export const SPONSOR_MANIFEST_LAYER_ORDER: ReadonlyArray<SponsorManifestLayerId> = Object.freeze(
  SPONSOR_MANIFEST_LAYERS.map((l) => l.layer),
);
