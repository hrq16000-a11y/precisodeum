/**
 * Phase 1.9.22 — Cross-layer trace correlation (deterministic).
 */
import {
  type SponsorAuditLayerId,
  type SponsorSignedArtifact,
  type SponsorTraceCorrelationVector,
  SPONSOR_AUDIT_LAYER_ORDER,
} from './sponsorAuditEnvelope';
import { deepFreeze, signObject } from './sponsorAuditInternals';

export type SponsorLayerInputs = Readonly<
  Partial<Record<SponsorAuditLayerId, SponsorSignedArtifact>>
>;

export function correlateCrossLayerTraces(
  inputs: SponsorLayerInputs,
): SponsorTraceCorrelationVector {
  const orderedLayers: SponsorAuditLayerId[] = [];
  const orderedSignatures: string[] = [];
  const correlationMap: Record<SponsorAuditLayerId, string | null> = {
    mesh: null,
    decision: null,
    campaign: null,
    temporal: null,
    contract: null,
    api: null,
    surface: null,
    consistency: null,
  };

  for (const layer of SPONSOR_AUDIT_LAYER_ORDER) {
    const art = inputs[layer];
    if (art && typeof art.signature === 'string' && art.signature.length > 0) {
      orderedLayers.push(layer);
      orderedSignatures.push(art.signature);
      correlationMap[layer] = art.signature;
    }
  }

  const chainSignature = signObject({
    orderedLayers,
    orderedSignatures,
  });

  return deepFreeze({
    chainSignature,
    orderedLayers: Object.freeze(orderedLayers),
    orderedSignatures: Object.freeze(orderedSignatures),
    correlationMap: Object.freeze(correlationMap),
  });
}
