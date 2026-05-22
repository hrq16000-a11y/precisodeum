/**
 * Rollout Envelope — envelope determinístico bit-stable.
 */
import { SPONSOR_ROLLOUT_INTERNALS } from './sponsorRolloutInternals';
import { buildRolloutSnapshot, type RolloutSnapshot } from './sponsorRolloutSnapshot';
import { buildRolloutLineage, type RolloutLineageEntry } from './sponsorRolloutLineage';
import { buildRolloutProofMatrix, type RolloutProof } from './sponsorRolloutProofs';

function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export interface RolloutEnvelope {
  readonly phase: string;
  readonly plane: string;
  readonly snapshot: RolloutSnapshot;
  readonly lineage: readonly RolloutLineageEntry[];
  readonly proofs: readonly RolloutProof[];
  readonly signature: string;
}

export function buildRolloutEnvelope(): RolloutEnvelope {
  const body = {
    phase: SPONSOR_ROLLOUT_INTERNALS.phase,
    plane: SPONSOR_ROLLOUT_INTERNALS.plane,
    snapshot: buildRolloutSnapshot(),
    lineage: buildRolloutLineage(),
    proofs: buildRolloutProofMatrix(),
  };
  const signature = djb2(canonical(body));
  return Object.freeze({ ...body, signature });
}
