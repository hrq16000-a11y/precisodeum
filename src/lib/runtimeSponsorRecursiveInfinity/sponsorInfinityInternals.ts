/**
 * Phase 1.9.44 — Sponsor Recursive Infinity · internals.
 * READ-ONLY · DETERMINISTIC · ZERO UPSTREAM MUTATION.
 */

export const SPONSOR_INFINITY_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  infinityMode: 'TERMINAL_RECURSIVE_SELF_CONTAINED' as const,
  upstreamMutationAllowed: false as const,
  deterministicRollbackRequired: true as const,
  postLockMutationAllowed: false as const,
});

export class SponsorInfinityMutationError extends Error {
  constructor(msg: string) {
    super(`[sponsor-infinity] mutation forbidden: ${msg}`);
    this.name = 'SponsorInfinityMutationError';
  }
}

export class SponsorInfinityDeterminismError extends Error {
  constructor(msg: string) {
    super(`[sponsor-infinity] determinism violation: ${msg}`);
    this.name = 'SponsorInfinityDeterminismError';
  }
}

export const SPONSOR_INFINITY_LAYER_ORDER = Object.freeze([
  '1.9.14', '1.9.15', '1.9.16', '1.9.17', '1.9.18', '1.9.19', '1.9.20',
  '1.9.21', '1.9.22', '1.9.23', '1.9.24', '1.9.25', '1.9.26', '1.9.27',
  '1.9.28', '1.9.29', '1.9.30', '1.9.31', '1.9.32', '1.9.33', '1.9.34',
  '1.9.35', '1.9.36', '1.9.37', '1.9.38', '1.9.39', '1.9.40', '1.9.41',
  '1.9.42', '1.9.43',
] as const);

export type SponsorInfinityLayerId =
  (typeof SPONSOR_INFINITY_LAYER_ORDER)[number];

export const SPONSOR_INFINITY_INVARIANTS = Object.freeze([
  { id: 'IN-LAYER-RECURSIVE-CONTAINMENT', title: 'Layer recursive containment',
    statement: 'Every upstream layer is recursively contained within the infinity plane.' },
  { id: 'IN-CANONICAL-RECURSIVE-ORDERING', title: 'Canonical recursive ordering',
    statement: 'Recursive ordering follows canonical layer sequence 1.9.14→1.9.43.' },
  { id: 'IN-INFINITY-LINEAGE-CONSISTENCY', title: 'Infinity lineage consistency',
    statement: 'Infinity lineage signatures are deterministic and reproducible.' },
  { id: 'IN-RECURSIVE-CONTAINMENT-PROOFS', title: 'Recursive containment proofs',
    statement: 'Containment proofs are formally complete for every layer.' },
  { id: 'IN-RECURSIVE-INFINITY-GRAPH', title: 'Recursive infinity graph',
    statement: 'Infinity graph converges at terminal:infinity node.' },
  { id: 'IN-INFINITY-ENVELOPE-IMMUTABILITY', title: 'Infinity envelope immutability',
    statement: 'Infinity envelopes are deep-frozen and locked.' },
  { id: 'IN-ZERO-UPSTREAM-MUTATION', title: 'Zero upstream mutation',
    statement: 'No upstream layer is mutated by the infinity plane.' },
  { id: 'IN-DETERMINISTIC-ROLLBACK', title: 'Deterministic rollback',
    statement: 'Rollback reproduces identical infinity envelopes.' },
  { id: 'IN-TERMINAL-RECURSIVE-INFINITY-CERTIFICATION', title: 'Terminal recursive infinity certification',
    statement: 'System is certified recursively infinite and self-contained end-to-end.' },
] as const);

export type SponsorInfinityInvariantId =
  (typeof SPONSOR_INFINITY_INVARIANTS)[number]['id'];

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
  return `in1:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}
