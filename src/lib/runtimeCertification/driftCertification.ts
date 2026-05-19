/**
 * Fase 1.7.12 — Drift certification (READ-ONLY).
 */

import { type FlowId } from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import type {
  RuntimeCertificationLevel,
  RuntimeDriftCertification,
} from './certificationTypes';

export function certifyDriftContainment(flow: FlowId): boolean {
  const p = getFlowDriftProfile(flow);
  if (!p) return true;
  if (p.depends_on_mirror && p.depends_on_eventual_sync) return false;
  return true;
}

export function detectUnboundedDrift(flow: FlowId): boolean {
  const p = getFlowDriftProfile(flow);
  if (!p) return false;
  return p.depends_on_mirror && p.depends_on_eventual_sync;
}

export function classifyDriftSafety(
  flow: FlowId,
): RuntimeDriftCertification['severity'] {
  const p = getFlowDriftProfile(flow);
  const blast = calculateBlastRadius(flow);
  if (!p) return 'NONE';
  if (p.depends_on_mirror && p.depends_on_eventual_sync) {
    return blast?.level === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
  }
  if (p.depends_on_mirror || p.depends_on_eventual_sync) return 'MEDIUM';
  return 'LOW';
}

function levelOf(severity: RuntimeDriftCertification['severity']): RuntimeCertificationLevel {
  switch (severity) {
    case 'NONE':
    case 'LOW':
      return 'FULL';
    case 'MEDIUM':
      return 'CONDITIONAL';
    case 'HIGH':
      return 'LIMITED';
    case 'CRITICAL':
      return 'NONE';
  }
}

export function buildDriftCertification(flow: FlowId): RuntimeDriftCertification {
  const severity = classifyDriftSafety(flow);
  return {
    flow,
    contained: certifyDriftContainment(flow),
    unbounded: detectUnboundedDrift(flow),
    severity,
    level: levelOf(severity),
  };
}
