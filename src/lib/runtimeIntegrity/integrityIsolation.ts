/**
 * Fase 1.8.5 — Integrity isolation (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IntegrityIsolation,
  IntegrityLayerKind,
  RuntimeIntegrityIsolation,
} from './integrityTypes';

export interface IsolationInput {
  readonly flow: FlowId;
  readonly leakedLayers: readonly IntegrityLayerKind[];
  readonly mirrorExposed?: boolean;
  readonly replayExposed?: boolean;
  readonly globallyExposed?: boolean;
}

export function classifyIsolationIntegrity(input: IsolationInput): IntegrityIsolation {
  if (input.globallyExposed || input.leakedLayers.length >= 4) return 'globally_exposed';
  if (input.replayExposed) return 'replay_exposed';
  if (input.mirrorExposed) return 'mirror_exposed';
  if (input.leakedLayers.length > 0) return 'boundary_shared';
  return 'isolated';
}

export function analyzeIntegrityIsolation(input: IsolationInput): RuntimeIntegrityIsolation {
  const isolation = classifyIsolationIntegrity(input);
  return {
    flow: input.flow,
    isolation,
    leakedLayers: input.leakedLayers,
    boundariesIntact: isolation === 'isolated',
  };
}

export function detectBoundaryExposure(i: RuntimeIntegrityIsolation): boolean {
  return i.isolation !== 'isolated';
}
export function detectReplayExposure(i: RuntimeIntegrityIsolation): boolean {
  return i.isolation === 'replay_exposed' || i.isolation === 'globally_exposed';
}
export function detectSharedBoundaryRisk(i: RuntimeIntegrityIsolation): boolean {
  return i.isolation === 'boundary_shared' || i.isolation === 'mirror_exposed';
}
export function detectGlobalExposure(i: RuntimeIntegrityIsolation): boolean {
  return i.isolation === 'globally_exposed';
}
