/**
 * Phase 1.9.22 — Sponsor Global Audit Ledger.
 * Top-level orchestrator. Read-only consolidation of cross-layer lineage,
 * correlation, replay, and audit envelope. Performs zero upstream mutation.
 */
import {
  type SponsorAuditEnvelope,
  type SponsorAuditLayerId,
  type SponsorAuditLedgerEntry,
} from './sponsorAuditEnvelope';
import {
  SponsorAuditMutationError,
  SPONSOR_AUDIT_INTERNALS,
  deepFreeze,
  signObject,
} from './sponsorAuditInternals';
import {
  correlateCrossLayerTraces,
  type SponsorLayerInputs,
} from './sponsorTraceCorrelation';
import { computeGlobalLineageGraph } from './sponsorGlobalLineageGraph';
import { generateReplayFrames } from './sponsorReplayEngine';

const ARTIFACT_KIND_BY_LAYER: Readonly<Record<SponsorAuditLayerId, string>> = Object.freeze({
  mesh: 'sponsor.mesh.snapshot',
  decision: 'sponsor.decision.snapshot',
  campaign: 'sponsor.campaign.snapshot',
  temporal: 'sponsor.temporal.snapshot',
  contract: 'sponsor.contract.snapshot.v1',
  api: 'sponsor.api.response.v1',
  surface: 'sponsor.surface.envelope.v1',
  consistency: 'sponsor.consistency.envelope.v1',
});

function buildLedger(
  inputs: SponsorLayerInputs,
  orderedLayers: ReadonlyArray<SponsorAuditLayerId>,
  orderedSignatures: ReadonlyArray<string>,
): ReadonlyArray<SponsorAuditLedgerEntry> {
  const entries: SponsorAuditLedgerEntry[] = [];
  for (let i = 0; i < orderedLayers.length; i++) {
    const layer = orderedLayers[i];
    const upstreamSignature = orderedSignatures[i];
    const lineageRefs: string[] = orderedSignatures.slice(0, i);
    const entrySignature = signObject({
      index: i,
      layer,
      artifactKind: ARTIFACT_KIND_BY_LAYER[layer],
      upstreamSignature,
      lineageRefs,
    });
    entries.push(
      Object.freeze({
        index: i,
        layer,
        artifactKind: ARTIFACT_KIND_BY_LAYER[layer],
        upstreamSignature,
        lineageRefs: Object.freeze(lineageRefs),
        entrySignature,
      }),
    );
    // Read-only contract: the upstream artifact must NOT be mutated.
    const original = inputs[layer];
    if (original && original.signature !== upstreamSignature) {
      throw new SponsorAuditMutationError(
        `upstream signature drift detected at layer=${layer}`,
      );
    }
  }
  return Object.freeze(entries);
}

export function buildGlobalAuditLedger(inputs: SponsorLayerInputs): SponsorAuditEnvelope {
  const correlation = correlateCrossLayerTraces(inputs);
  const lineage = computeGlobalLineageGraph(correlation);
  const replay = generateReplayFrames(correlation);
  const ledger = buildLedger(
    inputs,
    correlation.orderedLayers,
    correlation.orderedSignatures,
  );

  const envelopeSignature = signObject({
    v: 'v1',
    ledger: ledger.map((e) => e.entrySignature),
    correlation: correlation.chainSignature,
    lineage: lineage.graphSignature,
    replay: replay.replaySignature,
  });

  const envelope: SponsorAuditEnvelope = deepFreeze({
    envelopeVersion: 'v1' as const,
    ledger,
    correlation,
    lineage,
    replay,
    envelopeSignature,
    locked: true as const,
  });

  lockAuditEnvelope(envelope);
  return envelope;
}

export function lockAuditEnvelope(envelope: SponsorAuditEnvelope): void {
  if (!envelope.locked) {
    throw new SponsorAuditMutationError('envelope is not locked');
  }
  if (!Object.isFrozen(envelope) || !Object.isFrozen(envelope.ledger)) {
    throw new SponsorAuditMutationError('envelope or ledger not frozen');
  }
  if (SPONSOR_AUDIT_INTERNALS.upstreamMutationAllowed !== false) {
    throw new SponsorAuditMutationError('upstream mutation flag must be false');
  }
  if (SPONSOR_AUDIT_INTERNALS.recalculationAllowed !== false) {
    throw new SponsorAuditMutationError('recalculation flag must be false');
  }
}

export {
  correlateCrossLayerTraces,
  computeGlobalLineageGraph,
  generateReplayFrames,
};
