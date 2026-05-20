/**
 * Fase 1.8.4 — Collapse detection (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  CollapseSeverity,
  RuntimeCollapsePoint,
  RuntimeDependencyResolution,
} from './stabilityTypes';

export interface CollapseDetectionInput {
  readonly flow: FlowId;
  readonly resolution: RuntimeDependencyResolution;
  readonly mirrorDesync?: boolean;
  readonly finalizeGap?: boolean;
  readonly replayDivergence?: boolean;
  readonly temporalRegression?: boolean;
}

export function classifyCollapseSeverity(input: {
  cascade: boolean;
  blast: number;
  origin: RuntimeCollapsePoint['origin'];
}): CollapseSeverity {
  if (input.blast >= 5 || (input.cascade && input.origin !== 'temporal')) return 'critical';
  if (input.blast >= 3) return 'high';
  if (input.blast >= 2) return 'medium';
  if (input.blast >= 1) return 'low';
  return 'none';
}

export function calculateCollapseBlastRadius(
  resolution: RuntimeDependencyResolution,
): number {
  return resolution.unresolvedCount + (resolution.circular ? 2 : 0) + Math.max(0, resolution.depth - 2);
}

export function detectMirrorCollapse(input: CollapseDetectionInput): RuntimeCollapsePoint | null {
  if (!input.mirrorDesync) return null;
  const blast = calculateCollapseBlastRadius(input.resolution);
  return {
    flow: input.flow,
    step: 'mirror',
    severity: classifyCollapseSeverity({ cascade: blast >= 3, blast, origin: 'mirror' }),
    blastRadius: blast,
    cascade: blast >= 3,
    origin: 'mirror',
  };
}

export function detectFinalizeCollapse(input: CollapseDetectionInput): RuntimeCollapsePoint | null {
  if (!input.finalizeGap) return null;
  const blast = calculateCollapseBlastRadius(input.resolution) + 1;
  return {
    flow: input.flow,
    step: 'finalize',
    severity: classifyCollapseSeverity({ cascade: blast >= 3, blast, origin: 'finalize' }),
    blastRadius: blast,
    cascade: blast >= 3,
    origin: 'finalize',
  };
}

export function detectReplayCollapse(input: CollapseDetectionInput): RuntimeCollapsePoint | null {
  if (!input.replayDivergence) return null;
  const blast = calculateCollapseBlastRadius(input.resolution);
  return {
    flow: input.flow,
    step: 'replay',
    severity: classifyCollapseSeverity({ cascade: blast >= 3, blast, origin: 'replay' }),
    blastRadius: blast,
    cascade: blast >= 3,
    origin: 'replay',
  };
}

export function detectTemporalCollapse(input: CollapseDetectionInput): RuntimeCollapsePoint | null {
  if (!input.temporalRegression) return null;
  const blast = Math.max(1, calculateCollapseBlastRadius(input.resolution) - 1);
  return {
    flow: input.flow,
    step: 'temporal',
    severity: classifyCollapseSeverity({ cascade: false, blast, origin: 'temporal' }),
    blastRadius: blast,
    cascade: false,
    origin: 'temporal',
  };
}

export function detectCascadeCollapse(points: readonly RuntimeCollapsePoint[]): boolean {
  return points.filter((p) => p.cascade).length >= 2;
}

export function detectCollapsePoint(input: CollapseDetectionInput): readonly RuntimeCollapsePoint[] {
  const out: RuntimeCollapsePoint[] = [];
  const m = detectMirrorCollapse(input);
  if (m) out.push(m);
  const f = detectFinalizeCollapse(input);
  if (f) out.push(f);
  const r = detectReplayCollapse(input);
  if (r) out.push(r);
  const t = detectTemporalCollapse(input);
  if (t) out.push(t);
  if (input.resolution.circular && out.length === 0) {
    const blast = calculateCollapseBlastRadius(input.resolution);
    out.push({
      flow: input.flow,
      step: 'owner',
      severity: classifyCollapseSeverity({ cascade: true, blast, origin: 'owner' }),
      blastRadius: blast,
      cascade: true,
      origin: 'owner',
    });
  }
  return out;
}
