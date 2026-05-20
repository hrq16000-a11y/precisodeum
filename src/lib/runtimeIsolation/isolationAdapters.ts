/**
 * Fase 1.8.6 — Isolation adapters (READ-ONLY, INERT).
 * Derivam boundaries a partir das camadas anteriores sem mutar, persistir ou tocar PII.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { IsolationBoundary, IsolationBoundaryType } from './isolationTypes';
import { buildBoundary } from './boundaryIsolation';

interface LayerSignal {
  readonly type: IsolationBoundaryType;
  readonly intact: boolean;
  readonly sharedWith?: readonly IsolationBoundaryType[];
}

export interface RuntimeLayerInputs {
  readonly flow: FlowId;
  readonly recorder?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
  readonly history?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
  readonly replay?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
  readonly causality?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
  readonly stability?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
  readonly integrity?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
  readonly certification?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
  readonly governance?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
  readonly promotion?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
  readonly pilot?: { intact: boolean; sharedWith?: readonly IsolationBoundaryType[] };
}

export function adaptRuntimeLayersToBoundaries(
  inputs: RuntimeLayerInputs,
): readonly IsolationBoundary[] {
  const signals: Array<LayerSignal | undefined> = [
    inputs.recorder && { type: 'RUNTIME', intact: inputs.recorder.intact, sharedWith: inputs.recorder.sharedWith },
    inputs.history && { type: 'DRIFT', intact: inputs.history.intact, sharedWith: inputs.history.sharedWith },
    inputs.replay && { type: 'REPLAY', intact: inputs.replay.intact, sharedWith: inputs.replay.sharedWith },
    inputs.causality && { type: 'CAUSALITY', intact: inputs.causality.intact, sharedWith: inputs.causality.sharedWith },
    inputs.stability && { type: 'STABILITY', intact: inputs.stability.intact, sharedWith: inputs.stability.sharedWith },
    inputs.integrity && { type: 'INTEGRITY', intact: inputs.integrity.intact, sharedWith: inputs.integrity.sharedWith },
    inputs.certification && { type: 'CERTIFICATION', intact: inputs.certification.intact, sharedWith: inputs.certification.sharedWith },
    inputs.governance && { type: 'GOVERNANCE', intact: inputs.governance.intact, sharedWith: inputs.governance.sharedWith },
    inputs.promotion && { type: 'PROMOTION', intact: inputs.promotion.intact, sharedWith: inputs.promotion.sharedWith },
    inputs.pilot && { type: 'SIMULATION', intact: inputs.pilot.intact, sharedWith: inputs.pilot.sharedWith },
  ];
  const out: IsolationBoundary[] = [];
  for (const s of signals) {
    if (!s) continue;
    out.push(buildBoundary({
      flow: inputs.flow,
      type: s.type,
      intact: s.intact,
      sharedWith: s.sharedWith ?? [],
    }));
  }
  return out;
}
