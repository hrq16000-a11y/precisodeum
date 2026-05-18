/**
 * Fase 1.7.7 — Simulation integrity asserts (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import type {
  MigrationConfidence,
  SimulationViolation,
} from './simulationTypes';
import { simulateAll } from './simulateAtomicExecution';
import { detectAllDivergences } from './divergenceDetection';
import { calculateExecutionParity } from './executionParity';
import { simulateAllRollbacks } from './rollbackSimulation';
import { calculateAllBlastRadius } from './blastRadius';
import {
  calculateAllMigrationConfidence,
  calculateMigrationConfidence,
} from './migrationConfidence';
import { modelAllFailurePropagation } from './failurePropagation';

const VALID_CONFIDENCE: readonly MigrationConfidence[] = [
  'NOT_READY',
  'EXPERIMENTAL',
  'CONTROLLED',
  'SAFE_FOR_SHADOW',
  'READY_FOR_SOFT_ATOMIC',
];

export function assertSimulationCoverage(): SimulationViolation[] {
  const sims = simulateAll();
  const out: SimulationViolation[] = [];
  for (const r of OPERATION_REGISTRY) {
    if (!sims[r.flow]) {
      out.push({
        code: 'SIMULATION_MISSING',
        flow: r.flow,
        detail: 'no simulation produced for registered flow',
      });
    }
  }
  return out;
}

export function assertParityCoverage(): SimulationViolation[] {
  const all = calculateExecutionParity();
  const out: SimulationViolation[] = [];
  for (const r of OPERATION_REGISTRY) {
    const p = all[r.flow];
    if (!p) {
      out.push({
        code: 'PARITY_GAP',
        flow: r.flow,
        detail: 'parity result missing',
      });
      continue;
    }
    if (p.score < 50) {
      out.push({
        code: 'PARITY_GAP',
        flow: r.flow,
        detail: `parity score too low (${p.score})`,
      });
    }
  }
  return out;
}

export function assertRollbackSimulationCoverage(): SimulationViolation[] {
  const all = simulateAllRollbacks();
  const out: SimulationViolation[] = [];
  for (const r of OPERATION_REGISTRY) {
    const rep = all[r.flow];
    if (!rep || rep.cases.length === 0) {
      out.push({
        code: 'ROLLBACK_UNSAFE',
        flow: r.flow,
        detail: 'no rollback simulation cases produced',
      });
    }
  }
  return out;
}

export function assertBlastRadiusCoverage(): SimulationViolation[] {
  const all = calculateAllBlastRadius();
  const out: SimulationViolation[] = [];
  for (const r of OPERATION_REGISTRY) {
    if (!all[r.flow]) {
      out.push({
        code: 'BLAST_RADIUS_UNKNOWN',
        flow: r.flow,
        detail: 'blast radius missing',
      });
    }
  }
  return out;
}

export function assertMigrationConfidenceIntegrity(): SimulationViolation[] {
  const all = calculateAllMigrationConfidence();
  const out: SimulationViolation[] = [];
  for (const r of OPERATION_REGISTRY) {
    const rep = all[r.flow];
    if (!rep) {
      out.push({
        code: 'CONFIDENCE_INVALID',
        flow: r.flow,
        detail: 'confidence missing',
      });
      continue;
    }
    if (!VALID_CONFIDENCE.includes(rep.confidence)) {
      out.push({
        code: 'CONFIDENCE_INVALID',
        flow: r.flow,
        detail: `invalid confidence value: ${String(rep.confidence)}`,
      });
    }
    if (rep.score < 0 || rep.score > 100) {
      out.push({
        code: 'CONFIDENCE_INVALID',
        flow: r.flow,
        detail: `score out of range: ${rep.score}`,
      });
    }
  }
  return out;
}

export interface UnsafePromotion {
  flow: FlowId;
  promotedTo: MigrationConfidence;
}

/**
 * Garante que NENHUMA promoção automática para READY_FOR_SOFT_ATOMIC
 * tenha ocorrido sem suporte do score determinístico.
 * Fase 1.7.7 NÃO promove nada — só classifica.
 */
export function assertNoUnsafeSimulationPromotion(
  proposals: UnsafePromotion[] = [],
): SimulationViolation[] {
  const out: SimulationViolation[] = [];
  for (const p of proposals) {
    const rep = calculateMigrationConfidence(p.flow);
    if (!rep) {
      out.push({
        code: 'CONFIDENCE_INVALID',
        flow: p.flow,
        detail: 'unknown flow proposed for promotion',
      });
      continue;
    }
    if (
      p.promotedTo === 'READY_FOR_SOFT_ATOMIC' &&
      rep.confidence !== 'READY_FOR_SOFT_ATOMIC'
    ) {
      out.push({
        code: 'CONFIDENCE_INVALID',
        flow: p.flow,
        detail: 'unsafe promotion to READY_FOR_SOFT_ATOMIC',
      });
    }
  }
  return out;
}

export function assertDivergenceClassification(): SimulationViolation[] {
  const all = detectAllDivergences();
  const out: SimulationViolation[] = [];
  for (const r of OPERATION_REGISTRY) {
    const rep = all[r.flow];
    if (!rep) {
      out.push({
        code: 'DIVERGENCE_UNCLASSIFIED',
        flow: r.flow,
        detail: 'no divergence report',
      });
      continue;
    }
    for (const e of rep.entries) {
      if (!e.severity || !e.kind) {
        out.push({
          code: 'DIVERGENCE_UNCLASSIFIED',
          flow: r.flow,
          detail: 'entry missing severity or kind',
        });
      }
    }
  }
  return out;
}

export function assertFailurePropagationKnown(): SimulationViolation[] {
  const all = modelAllFailurePropagation();
  const out: SimulationViolation[] = [];
  for (const r of OPERATION_REGISTRY) {
    if (!all[r.flow]) {
      out.push({
        code: 'FAILURE_PROPAGATION_UNKNOWN',
        flow: r.flow,
        detail: 'no failure propagation report',
      });
    }
  }
  return out;
}

export function assertAllSimulationIntegrity(): SimulationViolation[] {
  return [
    ...assertSimulationCoverage(),
    ...assertParityCoverage(),
    ...assertRollbackSimulationCoverage(),
    ...assertBlastRadiusCoverage(),
    ...assertMigrationConfidenceIntegrity(),
    ...assertDivergenceClassification(),
    ...assertFailurePropagationKnown(),
  ];
}
