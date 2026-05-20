/**
 * Fase 1.8.8 — Immutable adapters (READ-ONLY, INERT).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { ImmutableBoundary, ImmutableLayer } from './immutableTypes';
import { buildBoundary } from './immutableSeal';

export interface LayerInput {
  readonly implicitMutation?: boolean;
  readonly boundaryOverride?: boolean;
  readonly recursiveUnlock?: boolean;
}

export interface RuntimeLayersInput {
  readonly flow: FlowId;
  readonly enforcement?: LayerInput;
  readonly isolation?: LayerInput;
  readonly integrity?: LayerInput;
  readonly stability?: LayerInput;
  readonly causality?: LayerInput;
  readonly replay?: LayerInput;
  readonly history?: LayerInput;
  readonly recorder?: LayerInput;
  readonly governance?: LayerInput;
  readonly promotion?: LayerInput;
  readonly certification?: LayerInput;
  readonly pilot?: LayerInput;
}

const MAP: ReadonlyArray<readonly [keyof RuntimeLayersInput, ImmutableLayer]> = [
  ['enforcement', 'enforcement'],
  ['isolation', 'isolation'],
  ['integrity', 'integrity'],
  ['stability', 'stability'],
  ['causality', 'causality'],
  ['replay', 'replay'],
  ['history', 'history'],
  ['recorder', 'recorder'],
  ['governance', 'governance'],
  ['promotion', 'promotion'],
  ['certification', 'certification'],
  ['pilot', 'pilot'],
];

export function adaptRuntimeLayersToBoundaries(
  inputs: RuntimeLayersInput,
): readonly ImmutableBoundary[] {
  const out: ImmutableBoundary[] = [];
  for (const [key, layer] of MAP) {
    const v = inputs[key] as LayerInput | undefined;
    if (!v) continue;
    out.push(buildBoundary({
      flow: inputs.flow,
      layer,
      implicitMutation: v.implicitMutation,
      boundaryOverride: v.boundaryOverride,
      recursiveUnlock: v.recursiveUnlock,
    }));
  }
  return out;
}
