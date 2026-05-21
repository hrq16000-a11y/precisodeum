/**
 * Phase 1.9.25 — Sponsor System Topology Synthesis · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION · ZERO BUSINESS LOGIC.
 */

export const SPONSOR_TOPOLOGY_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  topologyVersion: 'v1' as const,
  upstreamMutationAllowed: false,
  functionalActivationAllowed: false,
  recalculationAllowed: false,
  persistenceEnabled: false,
  liveExecutionEnabled: false,
  postLockMutationAllowed: false,
  deterministicRollbackRequired: true,
});

export class SponsorTopologyMutationError extends Error {
  constructor(message: string) {
    super(`[sponsor-topology] ${message}`);
    this.name = 'SponsorTopologyMutationError';
  }
}

export class SponsorTopologyDeterminismError extends Error {
  constructor(message: string) {
    super(`[sponsor-topology:determinism] ${message}`);
    this.name = 'SponsorTopologyDeterminismError';
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

export type SponsorTopologyLayerId =
  | 'mesh'           // 1.9.14
  | 'decision'       // 1.9.15
  | 'campaign'       // 1.9.16
  | 'temporal'       // 1.9.17
  | 'contract'       // 1.9.18
  | 'api'            // 1.9.19
  | 'surface'        // 1.9.20
  | 'consistency'    // 1.9.21
  | 'audit'          // 1.9.22
  | 'governance'     // 1.9.23
  | 'capability';    // 1.9.24

export const SPONSOR_TOPOLOGY_LAYER_ORDER: ReadonlyArray<SponsorTopologyLayerId> = Object.freeze([
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
]);

export const SPONSOR_TOPOLOGY_LAYER_PHASE: Readonly<Record<SponsorTopologyLayerId, string>> =
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
  });

export type SponsorTopologyPlane = 'engine' | 'distribution' | 'observability' | 'control';

export const SPONSOR_TOPOLOGY_LAYER_PLANE: Readonly<Record<SponsorTopologyLayerId, SponsorTopologyPlane>> =
  Object.freeze({
    mesh: 'engine',
    decision: 'engine',
    campaign: 'engine',
    temporal: 'engine',
    contract: 'distribution',
    api: 'distribution',
    surface: 'distribution',
    consistency: 'distribution',
    audit: 'observability',
    governance: 'control',
    capability: 'control',
  });
