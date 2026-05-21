/**
 * Phase 1.9.27 — Sponsor Replay Equivalence Matrix.
 * Pairwise structural equivalence between replay timeline ticks.
 * Pure read-only.
 */
import { deepFreeze, signObject } from './sponsorReplayInternals';
import type { SponsorReplayTimeline } from './sponsorReplayTimeline';

export interface SponsorReplayEquivalenceCell {
  readonly fromTick: number;
  readonly toTick: number;
  readonly equivalent: boolean;
  readonly drift: ReadonlyArray<string>;
  readonly cellSignature: string;
}

export interface SponsorReplayEquivalenceMatrix {
  readonly version: 'v1';
  readonly cells: ReadonlyArray<SponsorReplayEquivalenceCell>;
  readonly matrixSignature: string;
}

export function buildEquivalenceMatrix(
  timeline: SponsorReplayTimeline,
): SponsorReplayEquivalenceMatrix {
  const cells: SponsorReplayEquivalenceCell[] = [];
  for (let i = 0; i < timeline.ticks.length; i++) {
    for (let j = i; j < timeline.ticks.length; j++) {
      const a = timeline.ticks[i];
      const b = timeline.ticks[j];
      const drift: string[] = [];
      const len = Math.max(a.frames.length, b.frames.length);
      for (let k = 0; k < len; k++) {
        const fa = a.frames[k];
        const fb = b.frames[k];
        if (!fa || !fb) {
          drift.push(`missing@${k}`);
          continue;
        }
        if (fa.layer !== fb.layer) drift.push(`layer@${k}`);
        else if (fa.signature !== fb.signature) drift.push(`signature@${fa.layer}`);
      }
      const equivalent = drift.length === 0;
      cells.push(
        Object.freeze({
          fromTick: a.tick,
          toTick: b.tick,
          equivalent,
          drift: Object.freeze([...drift]),
          cellSignature: signObject({ from: a.tick, to: b.tick, equivalent, drift }),
        }),
      );
    }
  }
  const matrixSignature = signObject(cells.map((c) => c.cellSignature));
  return deepFreeze({
    version: 'v1' as const,
    cells: Object.freeze(cells),
    matrixSignature,
  });
}
