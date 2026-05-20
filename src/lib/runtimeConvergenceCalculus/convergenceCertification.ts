/**
 * Fase 1.9.2 — Convergence certification (READ-ONLY).
 */

import type {
  ConvergenceCertification,
  ConvergenceCertificationRank,
  ConvergenceClass,
  DivergenceTopology,
  MonotonicResolution,
  ResolutionFixedPoint,
  SaturationEnvelope,
  StabilityEnvelopeModel,
  TerminalResolutionState,
} from './convergenceTypes';

export interface CertificationInput {
  readonly classification: ConvergenceClass;
  readonly fixedPoints: readonly ResolutionFixedPoint[];
  readonly saturation: SaturationEnvelope;
  readonly terminal: TerminalResolutionState;
  readonly monotonic: MonotonicResolution;
  readonly stability: StabilityEnvelopeModel;
  readonly divergence: DivergenceTopology;
  readonly readOnlyOk: boolean;
}

export function calculateConvergenceConfidence(
  input: CertificationInput,
): number {
  let score = 1;
  if (!input.readOnlyOk) score -= 1;
  if (input.classification === 'DIVERGENT') score -= 0.6;
  if (input.classification === 'COLLAPSING') score -= 0.5;
  if (input.classification === 'OSCILLATING') score -= 0.3;
  if (input.saturation.level === 'CRITICAL') score -= 0.4;
  else if (input.saturation.level === 'HIGH') score -= 0.2;
  if (input.terminal.failed) score -= 0.3;
  if (input.terminal.infinite) score -= 0.3;
  if (input.monotonic.regressed) score -= 0.15;
  if (input.monotonic.classification === 'BROKEN') score -= 0.1;
  if (input.monotonic.classification === 'REVERSING') score -= 0.2;
  if (!input.stability.bounded) score -= 0.3;
  if (input.stability.overflow) score -= 0.3;
  if (input.divergence.severity === 'CRITICAL') score -= 0.4;
  else if (input.divergence.severity === 'HIGH') score -= 0.25;
  return Math.max(0, Math.min(1, score));
}

export function detectUnsafeConvergence(input: CertificationInput): boolean {
  return (
    !input.readOnlyOk ||
    input.classification === 'DIVERGENT' ||
    input.classification === 'COLLAPSING' ||
    input.saturation.level === 'CRITICAL' ||
    input.terminal.infinite ||
    input.stability.overflow ||
    input.divergence.severity === 'CRITICAL'
  );
}

export function assertConvergenceSafety(input: CertificationInput): readonly string[] {
  const reasons: string[] = [];
  if (!input.readOnlyOk) reasons.push('read-only invariants broken');
  if (input.classification === 'DIVERGENT') reasons.push('classification divergent');
  if (input.classification === 'COLLAPSING') reasons.push('classification collapsing');
  if (input.saturation.level === 'CRITICAL') reasons.push('saturation critical');
  if (input.terminal.infinite) reasons.push('infinite resolution');
  if (input.terminal.failed) reasons.push('terminal failure');
  if (input.stability.overflow) reasons.push('stability envelope overflow');
  if (input.divergence.severity === 'CRITICAL') reasons.push('divergence critical');
  if (input.monotonic.classification === 'REVERSING') reasons.push('monotonicity reversing');
  return Object.freeze(reasons);
}

export function certifyConvergence(input: CertificationInput): ConvergenceCertification {
  const confidence = calculateConvergenceConfidence(input);
  const reasons = assertConvergenceSafety(input);
  const unsafe = detectUnsafeConvergence(input);
  let rank: ConvergenceCertificationRank;
  if (unsafe || confidence < 0.4) rank = 'BLOCKED';
  else if (confidence < 0.6) rank = 'CONDITIONAL';
  else if (confidence < 0.85) rank = 'PARTIAL';
  else rank = 'FULL';
  return Object.freeze({ rank, confidence, safe: !unsafe, reasons });
}
