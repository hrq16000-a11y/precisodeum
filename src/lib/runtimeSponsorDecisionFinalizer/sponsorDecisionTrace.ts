/**
 * Phase 1.9.15 — Decision trace. Bridges decision snapshot into the
 * attribution lineage from 1.9.14 without modifying it.
 */
import type { SponsorAttributionTrace } from '@/lib/runtimeSponsorMonetizationMesh';
import type { SponsorDecisionEntry, SponsorDecisionSnapshot } from './sponsorDecisionModel';

export interface SponsorDecisionTraceEntry {
  readonly slotId: string;
  readonly sponsorId: string | null;
  readonly priority: number;
  readonly finalScore: number;
  readonly reason: SponsorDecisionEntry['reason'];
  readonly lineage: ReadonlyArray<string>;
  readonly attributionSignature: string | null;
}

function findTrace(
  traces: ReadonlyArray<SponsorAttributionTrace>,
  sponsorId: string,
  slotId: string,
): SponsorAttributionTrace | undefined {
  for (const t of traces) {
    if (t.sponsorId === sponsorId && t.slotId === slotId) return t;
  }
  return undefined;
}

export function emitDecisionTrace(
  snapshot: SponsorDecisionSnapshot,
  attribution: ReadonlyArray<SponsorAttributionTrace>,
): ReadonlyArray<SponsorDecisionTraceEntry> {
  return Object.freeze(
    snapshot.entries.map((e) => {
      const trace = e.sponsorId ? findTrace(attribution, e.sponsorId, e.slotId) : undefined;
      return Object.freeze({
        slotId: e.slotId,
        sponsorId: e.sponsorId,
        priority: e.priority,
        finalScore: e.finalScore,
        reason: e.reason,
        lineage: trace?.lineage ?? Object.freeze([]),
        attributionSignature: trace?.signature ?? null,
      });
    }),
  );
}
