/**
 * Phase 1.9.34 — Sponsor Absolute Identity.
 * Deterministic registry of ontology nodes (one per upstream layer).
 */
import {
  SPONSOR_EXISTENCE_LAYER_ORDER,
  SPONSOR_EXISTENCE_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorExistenceLayerId,
} from './sponsorExistenceInternals';

export interface SponsorAbsoluteIdentityNode {
  readonly id: SponsorExistenceLayerId;
  readonly phase: string;
  readonly upstreamSignature: string;
  readonly nodeSignature: string;
  readonly present: boolean;
}

export interface SponsorAbsoluteIdentityInput {
  readonly id: SponsorExistenceLayerId;
  readonly upstreamSignature?: string;
}

export interface SponsorAbsoluteIdentity {
  readonly version: 'v1';
  readonly nodes: ReadonlyArray<SponsorAbsoluteIdentityNode>;
  readonly identitySignature: string;
  readonly absoluteIdentity: string;
}

export function generateExistenceIdentity(
  inputs: ReadonlyArray<SponsorAbsoluteIdentityInput> = [],
): SponsorAbsoluteIdentity {
  const map = new Map<SponsorExistenceLayerId, string>();
  for (const i of inputs) if (i?.id) map.set(i.id, i.upstreamSignature ?? '');
  const nodes: SponsorAbsoluteIdentityNode[] = SPONSOR_EXISTENCE_LAYER_ORDER.map((id) => {
    const upstreamSignature = map.get(id) ?? '';
    const present = map.has(id);
    return Object.freeze({
      id,
      phase: SPONSOR_EXISTENCE_LAYER_PHASE[id],
      upstreamSignature,
      present,
      nodeSignature: signObject({
        id,
        phase: SPONSOR_EXISTENCE_LAYER_PHASE[id],
        upstreamSignature,
        present,
      }),
    });
  });
  const identitySignature = signObject(nodes.map((n) => n.nodeSignature));
  const absoluteIdentity = signObject({ v: 'v1', identity: identitySignature });
  return deepFreeze({
    version: 'v1' as const,
    nodes: Object.freeze(nodes),
    identitySignature,
    absoluteIdentity,
  });
}
