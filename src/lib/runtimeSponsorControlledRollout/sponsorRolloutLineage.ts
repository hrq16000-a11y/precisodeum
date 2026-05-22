/**
 * Rollout Lineage — linhagem cumulativa do orchestrator.
 */
import { SPONSOR_ROLLOUT_INTERNALS } from './sponsorRolloutInternals';

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export interface RolloutLineageEntry {
  readonly layer: string;
  readonly cumulativeSignature: string;
}

export function buildRolloutLineage(): readonly RolloutLineageEntry[] {
  const out: RolloutLineageEntry[] = [];
  let acc = 'rollout-cro-1.9.49';
  for (const layer of SPONSOR_ROLLOUT_INTERNALS.consumes) {
    acc = djb2(acc + '|' + layer);
    out.push(Object.freeze({ layer, cumulativeSignature: acc }));
  }
  return Object.freeze(out);
}
