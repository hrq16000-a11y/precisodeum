/**
 * Phase 1.9.42 — Sponsor Eternal Canonical Invariance · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION.
 */

export const SPONSOR_ETERNAL_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  eternalMode: 'TERMINAL_PERMANENT_INVARIANT' as const,
  upstreamMutationAllowed: false as const,
  deterministicRollbackRequired: true as const,
  postLockMutationAllowed: false as const,
});

export class SponsorEternalMutationError extends Error {
  constructor(msg: string) {
    super(`[sponsor-eternal] mutation forbidden: ${msg}`);
    this.name = 'SponsorEternalMutationError';
  }
}

export class SponsorEternalDeterminismError extends Error {
  constructor(msg: string) {
    super(`[sponsor-eternal] determinism violation: ${msg}`);
    this.name = 'SponsorEternalDeterminismError';
  }
}

export const SPONSOR_ETERNAL_LAYER_ORDER = Object.freeze([
  '1.9.14', '1.9.15', '1.9.16', '1.9.17', '1.9.18', '1.9.19', '1.9.20',
  '1.9.21', '1.9.22', '1.9.23', '1.9.24', '1.9.25', '1.9.26', '1.9.27',
  '1.9.28', '1.9.29', '1.9.30', '1.9.31', '1.9.32', '1.9.33', '1.9.34',
  '1.9.35', '1.9.36', '1.9.37', '1.9.38', '1.9.39', '1.9.40', '1.9.41',
] as const);

export type SponsorEternalLayerId = (typeof SPONSOR_ETERNAL_LAYER_ORDER)[number];

export const SPONSOR_ETERNAL_INVARIANTS = Object.freeze([
  { id: 'ET-LAYER-PERMANENT-INVARIANCE', title: 'Layer permanent invariance',
    statement: 'Every upstream layer is eternally invariant under reconstruction.' },
  { id: 'ET-CANONICAL-PERMANENCE-ORDERING', title: 'Canonical permanence ordering',
    statement: 'Permanence ordering follows canonical layer sequence 1.9.14→1.9.41.' },
  { id: 'ET-ETERNAL-LINEAGE-CONSISTENCY', title: 'Eternal lineage consistency',
    statement: 'Eternal lineage signatures are deterministic and reproducible.' },
  { id: 'ET-PERMANENT-STABILITY-PROOFS', title: 'Permanent stability proofs',
    statement: 'Stability proofs are formally complete for every layer.' },
  { id: 'ET-PERMANENT-INVARIANCE-GRAPH', title: 'Permanent invariance graph',
    statement: 'Invariance graph converges at terminal:eternity node.' },
  { id: 'ET-ETERNAL-ENVELOPE-IMMUTABILITY', title: 'Eternal envelope immutability',
    statement: 'Eternal envelopes are deep-frozen and locked.' },
  { id: 'ET-ZERO-UPSTREAM-MUTATION', title: 'Zero upstream mutation',
    statement: 'No upstream layer is mutated by the eternity plane.' },
  { id: 'ET-DETERMINISTIC-ROLLBACK', title: 'Deterministic rollback',
    statement: 'Rollback reproduces identical eternal envelopes.' },
  { id: 'ET-TERMINAL-PERMANENT-INVARIANCE-CERTIFICATION', title: 'Terminal permanent invariance certification',
    statement: 'System is certified eternally invariant end-to-end.' },
] as const);

export type SponsorEternalInvariantId =
  (typeof SPONSOR_ETERNAL_INVARIANTS)[number]['id'];

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) {
      deepFreeze((o as Record<string, unknown>)[k]);
    }
  }
  return o;
}

function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const keys = Object.keys(v as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
}

export function signObject(v: unknown): string {
  const s = stable(v);
  let h1 = 0x811c9dc5, h2 = 0xdeadbeef;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return `et1:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}
