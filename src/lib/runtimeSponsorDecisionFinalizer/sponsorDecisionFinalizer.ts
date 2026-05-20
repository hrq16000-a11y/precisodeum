/**
 * Phase 1.9.15 — Sponsor Decision Finalizer.
 *
 * SINGLE SOURCE OF TRUTH for sponsor exposure.
 *
 * Pipeline:
 *   Mesh (1.9.14) → normalize → compose → order → lock snapshot.
 *
 * NO post-decision mutation. NO re-ranking. NO re-allocation.
 * NO billing. NO live execution. NO side-effects.
 */
import type {
  SponsorDecisionContext,
  SponsorDecisionEntry,
  SponsorDecisionSnapshot,
  NormalizedDecisionInput,
} from './sponsorDecisionModel';
import { SPONSOR_DECISION_INTERNALS } from './sponsorDecisionModel';
import { normalizeDecisionInputs } from './sponsorDecisionNormalizer';
import { composeFinalScore } from './sponsorDecisionComposer';
import {
  deepFreeze,
  signSnapshotPayload,
  assertSnapshotLocked,
} from './sponsorDecisionSnapshot';

export function computeFinalRankingVector(
  inputs: ReadonlyArray<NormalizedDecisionInput>,
): ReadonlyArray<{ slotId: string; sponsorId: string | null; finalScore: number }> {
  return deepFreeze(
    inputs.map((i) => ({
      slotId: i.slotId,
      sponsorId: i.sponsorId,
      finalScore: composeFinalScore(i),
    })),
  );
}

export function resolveSlotAssignments(
  entries: ReadonlyArray<SponsorDecisionEntry>,
): Readonly<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const e of entries) out[e.slotId] = e.sponsorId;
  return Object.freeze(out);
}

export function buildFinalDecision(ctx: SponsorDecisionContext): SponsorDecisionSnapshot {
  const inputs = normalizeDecisionInputs(
    ctx.allocations,
    ctx.slots,
    ctx.fairness,
    ctx.saturation,
    ctx.geo,
    ctx.exposures,
  );

  const reasonBySlot = new Map(ctx.allocations.map((a) => [a.slotId, a.reason]));

  // Pair inputs with composed scores
  const scored: Array<{
    input: NormalizedDecisionInput;
    finalScore: number;
    reason: SponsorDecisionEntry['reason'];
  }> = inputs.map((input) => ({
    input,
    finalScore: composeFinalScore(input),
    reason: reasonBySlot.get(input.slotId) ?? 'no_candidates',
  }));

  // Deterministic ordering: finalScore desc, then slotId asc (stable, total)
  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return a.input.slotId.localeCompare(b.input.slotId);
  });

  const entries: SponsorDecisionEntry[] = scored.map((s, idx) =>
    Object.freeze({
      slotId: s.input.slotId,
      sponsorId: s.input.sponsorId,
      finalScore: s.finalScore,
      priority: idx,
      inputs: s.input,
      reason: s.reason,
    }),
  );

  const frozenEntries = Object.freeze(entries);
  const assignments = resolveSlotAssignments(frozenEntries);
  const orderedSlots = Object.freeze(frozenEntries.map((e) => e.slotId));

  const signature = signSnapshotPayload({
    entries: frozenEntries,
    assignments,
    orderedSlots,
    internals: SPONSOR_DECISION_INTERNALS,
  });

  const snapshot: SponsorDecisionSnapshot = deepFreeze({
    version: '1.9.15' as const,
    internals: SPONSOR_DECISION_INTERNALS,
    entries: frozenEntries,
    assignments,
    orderedSlots,
    signature,
    locked: true as const,
  });

  // Defensive: enforce contract before returning.
  assertSnapshotLocked(snapshot);
  return snapshot;
}

export function lockDecisionSnapshot(snapshot: SponsorDecisionSnapshot): SponsorDecisionSnapshot {
  assertSnapshotLocked(snapshot);
  return snapshot;
}
