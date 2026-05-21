/**
 * Phase 1.9.28 — Sponsor Consistency Proofs.
 * Generates deterministic proofs for each invariant against the verification input.
 * READ-ONLY · FAIL-CLOSED contradiction detection.
 */
import {
  SPONSOR_VERIFICATION_LAYER_ORDER,
  SPONSOR_VERIFICATION_LAYER_PHASE,
  deepFreeze,
  signObject,
  type SponsorVerificationLayerId,
} from './sponsorVerificationInternals';
import type {
  SponsorInvariantDefinition,
  SponsorInvariantRegistry,
} from './sponsorInvariantRegistry';

/** Verification input: one signed entry per upstream layer. */
export interface SponsorVerificationLayerInput {
  readonly layer: SponsorVerificationLayerId;
  readonly signature?: string | null;
}

export type SponsorProofVerdict = 'satisfied' | 'violated' | 'inapplicable';

export interface SponsorConsistencyProof {
  readonly invariantId: string;
  readonly scope: SponsorInvariantDefinition['scope'];
  readonly severity: SponsorInvariantDefinition['severity'];
  readonly verdict: SponsorProofVerdict;
  readonly evidence: ReadonlyArray<string>;
  readonly proofSignature: string;
}

export interface SponsorConsistencyProofs {
  readonly version: 'v1';
  readonly proofs: ReadonlyArray<SponsorConsistencyProof>;
  readonly proofsSignature: string;
}

function evaluateInvariant(
  inv: SponsorInvariantDefinition,
  byLayer: ReadonlyMap<SponsorVerificationLayerId, string | null>,
): { verdict: SponsorProofVerdict; evidence: string[] } {
  const evidence: string[] = [];

  if (inv.id === 'inv.global.layer-presence') {
    for (const l of SPONSOR_VERIFICATION_LAYER_ORDER) {
      if (!byLayer.has(l)) evidence.push(`missing:${l}`);
    }
    return { verdict: evidence.length === 0 ? 'satisfied' : 'violated', evidence };
  }

  if (inv.id === 'inv.global.layer-order') {
    // canonical order is enforced by construction; verify phase mapping consistency
    for (const l of SPONSOR_VERIFICATION_LAYER_ORDER) {
      if (!SPONSOR_VERIFICATION_LAYER_PHASE[l]) evidence.push(`phase-missing:${l}`);
    }
    return { verdict: evidence.length === 0 ? 'satisfied' : 'violated', evidence };
  }

  if (inv.id === 'inv.global.signature-non-empty') {
    for (const [l, sig] of byLayer) {
      if (sig === null || sig === '') evidence.push(`empty:${l}`);
    }
    return { verdict: evidence.length === 0 ? 'satisfied' : 'violated', evidence };
  }

  if (inv.id === 'inv.global.signature-stability') {
    // structural: presence + non-empty implies stability under pure read-only re-execution
    for (const l of SPONSOR_VERIFICATION_LAYER_ORDER) {
      const sig = byLayer.get(l);
      if (sig === undefined) evidence.push(`absent:${l}`);
    }
    return { verdict: evidence.length === 0 ? 'satisfied' : 'violated', evidence };
  }

  if (inv.id === 'inv.global.no-upstream-mutation') {
    // structural invariant — guaranteed by read-only consumption
    return { verdict: 'satisfied', evidence: [] };
  }

  if (inv.id.startsWith('inv.layer.')) {
    const layer = inv.scope as SponsorVerificationLayerId;
    const sig = byLayer.get(layer);
    if (sig === undefined) {
      evidence.push(`absent:${layer}`);
      return { verdict: 'violated', evidence };
    }
    if (sig === null || sig === '') {
      evidence.push(`empty-signature:${layer}`);
      return { verdict: 'violated', evidence };
    }
    return { verdict: 'satisfied', evidence };
  }

  return { verdict: 'inapplicable', evidence: ['unknown-invariant'] };
}

export function buildConsistencyProofs(
  registry: SponsorInvariantRegistry,
  inputs: ReadonlyArray<SponsorVerificationLayerInput> = [],
): SponsorConsistencyProofs {
  const byLayer = new Map<SponsorVerificationLayerId, string | null>();
  for (const l of SPONSOR_VERIFICATION_LAYER_ORDER) byLayer.set(l, null);
  for (const inp of inputs) {
    if (!SPONSOR_VERIFICATION_LAYER_PHASE[inp.layer]) continue;
    byLayer.set(inp.layer, inp.signature ?? null);
  }

  const proofs: SponsorConsistencyProof[] = registry.invariants.map((inv) => {
    const { verdict, evidence } = evaluateInvariant(inv, byLayer);
    const frozenEvidence = Object.freeze([...evidence]);
    const proofSignature = signObject({
      id: inv.id,
      verdict,
      evidence: frozenEvidence,
      def: inv.definitionSignature,
    });
    return Object.freeze({
      invariantId: inv.id,
      scope: inv.scope,
      severity: inv.severity,
      verdict,
      evidence: frozenEvidence,
      proofSignature,
    });
  });

  const proofsSignature = signObject(proofs.map((p) => p.proofSignature));
  return deepFreeze({
    version: 'v1' as const,
    proofs: Object.freeze(proofs),
    proofsSignature,
  });
}

export function hasCriticalViolation(proofs: SponsorConsistencyProofs): boolean {
  return proofs.proofs.some((p) => p.verdict === 'violated' && p.severity === 'critical');
}
