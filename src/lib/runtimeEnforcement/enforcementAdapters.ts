/**
 * Fase 1.8.7 — Enforcement adapters (READ-ONLY, INERT).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { EnforcementBoundary, EnforcementLayer } from './enforcementTypes';
import { buildBoundary } from './boundaryEnforcement';

export interface LayerInput {
  readonly intact?: boolean;
  readonly implicitMutation?: boolean;
  readonly crossLayerMutation?: boolean;
}

export interface RuntimeLayersInput {
  readonly flow: FlowId;
  readonly isolation?: LayerInput;
  readonly integrity?: LayerInput;
  readonly stability?: LayerInput;
  readonly causality?: LayerInput;
  readonly replay?: LayerInput;
  readonly history?: LayerInput;
  readonly recorder?: LayerInput;
  readonly certification?: LayerInput;
  readonly governance?: LayerInput;
  readonly promotion?: LayerInput;
  readonly pilot?: LayerInput;
}

const MAP: ReadonlyArray<readonly [keyof RuntimeLayersInput, EnforcementLayer]> = [
  ['isolation', 'isolation'],
  ['integrity', 'integrity'],
  ['stability', 'stability'],
  ['causality', 'causality'],
  ['replay', 'replay'],
  ['history', 'history'],
  ['recorder', 'recorder'],
  ['certification', 'certification'],
  ['governance', 'governance'],
  ['promotion', 'promotion'],
  ['pilot', 'pilot'],
];

export function adaptLayersToBoundaries(
  inputs: RuntimeLayersInput,
): readonly EnforcementBoundary[] {
  const out: EnforcementBoundary[] = [];
  for (const [key, layer] of MAP) {
    const v = inputs[key] as LayerInput | undefined;
    if (!v) continue;
    out.push(buildBoundary({
      flow: inputs.flow,
      layer,
      implicitMutation: v.implicitMutation,
      crossLayerMutation: v.crossLayerMutation,
    }));
  }
  return out;
}
