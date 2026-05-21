/**
 * Phase 1.9.30 — Sponsor Execution Semantics.
 * Deterministic registry of execution-semantic descriptors per layer.
 */
import {
  SPONSOR_SPECIFICATION_LAYERS,
  SPONSOR_SPECIFICATION_LAYER_ORDER,
  deepFreeze,
  signObject,
  type SponsorExecutionSemanticKind,
  type SponsorSpecificationLayerId,
  type SponsorSpecificationPlane,
} from './sponsorSpecificationInternals';

export interface SponsorSpecificationLayerInput {
  readonly layer: SponsorSpecificationLayerId;
  readonly signature?: string | null;
}

export interface SponsorExecutionSemanticDescriptor {
  readonly layer: SponsorSpecificationLayerId;
  readonly phase: string;
  readonly plane: SponsorSpecificationPlane;
  readonly semantics: SponsorExecutionSemanticKind;
  readonly signature: string | null;
  readonly present: boolean;
  readonly guarantees: ReadonlyArray<string>;
  readonly descriptorSignature: string;
}

export interface SponsorExecutionSemanticsRegistry {
  readonly version: 'v1';
  readonly descriptors: ReadonlyArray<SponsorExecutionSemanticDescriptor>;
  readonly semanticsSignature: string;
}

const CANONICAL_GUARANTEES: Record<SponsorExecutionSemanticKind, ReadonlyArray<string>> = {
  'deterministic-pure': Object.freeze([
    'bit-stable-output',
    'no-side-effects',
    'rollback-reproducible',
  ]),
  'deterministic-orchestration': Object.freeze([
    'bit-stable-output',
    'ordered-composition',
    'rollback-reproducible',
  ]),
  'read-only-projection': Object.freeze([
    'no-upstream-mutation',
    'bit-stable-projection',
    'rollback-reproducible',
  ]),
  'introspective-synthesis': Object.freeze([
    'no-upstream-mutation',
    'canonical-ordering',
    'rollback-reproducible',
  ]),
};

export function generateExecutionSemantics(
  inputs: ReadonlyArray<SponsorSpecificationLayerInput> = [],
): SponsorExecutionSemanticsRegistry {
  const byLayer = new Map<SponsorSpecificationLayerId, string | null>();
  for (const inp of inputs) {
    if (!SPONSOR_SPECIFICATION_LAYER_ORDER.includes(inp.layer)) continue;
    byLayer.set(inp.layer, inp.signature ?? null);
  }
  const descriptors: SponsorExecutionSemanticDescriptor[] = SPONSOR_SPECIFICATION_LAYERS.map(
    (spec) => {
      const signature = byLayer.has(spec.layer) ? byLayer.get(spec.layer) ?? null : null;
      const present = signature !== null && signature !== '';
      const guarantees = CANONICAL_GUARANTEES[spec.semantics];
      return Object.freeze({
        layer: spec.layer,
        phase: spec.phase,
        plane: spec.plane,
        semantics: spec.semantics,
        signature,
        present,
        guarantees,
        descriptorSignature: signObject({
          layer: spec.layer,
          phase: spec.phase,
          plane: spec.plane,
          semantics: spec.semantics,
          signature,
          present,
          guarantees,
        }),
      });
    },
  );
  const semanticsSignature = signObject(descriptors.map((d) => d.descriptorSignature));
  return deepFreeze({
    version: 'v1' as const,
    descriptors: Object.freeze(descriptors),
    semanticsSignature,
  });
}
