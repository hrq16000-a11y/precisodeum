/**
 * Fase 1.7.8 — Promotion requirements (READ-ONLY, pure).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import { simulateFlow } from '@/lib/atomicSimulation/simulateAtomicExecution';
import type { PromotionRequirement } from './promotionTypes';

export function hasRequiredBoundaries(flow: FlowId): boolean {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  return !!reg && !!reg.boundary && reg.boundary !== 'inline_call_site';
}

export function hasRequiredContracts(flow: FlowId): boolean {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return false;
  // Contratos = registry possui steps + dependencies declarados (cobertura 1.7.5).
  return reg.steps.length > 0 && reg.dependencies.length > 0;
}

export function hasRequiredSimulationCoverage(flow: FlowId): boolean {
  return simulateFlow(flow) !== null;
}

export function hasRequiredRollbackStrategy(flow: FlowId): boolean {
  return !!getRollbackStrategy(flow);
}

export function hasRequiredDriftCoverage(flow: FlowId): boolean {
  // Flows com mirror/eventual sync precisam de profile declarado.
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return false;
  const profile = getFlowDriftProfile(flow);
  return !!profile;
}

export function hasRequiredObservability(flow: FlowId): boolean {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return false;
  // Admin flows exigem side effects de audit declarados.
  if (reg.boundary === 'adminWriteBoundary') {
    return reg.sideEffects.some((s) => s.includes('audit'));
  }
  return true;
}

export function getPromotionRequirements(flow: FlowId): PromotionRequirement[] {
  return [
    {
      id: 'boundary_coverage',
      description: 'Flow possui boundary declarada (não inline).',
      met: hasRequiredBoundaries(flow),
    },
    {
      id: 'contract_coverage',
      description: 'Flow declara steps e dependências no operationRegistry.',
      met: hasRequiredContracts(flow),
    },
    {
      id: 'simulation_coverage',
      description: 'Flow possui simulação atomic registrada.',
      met: hasRequiredSimulationCoverage(flow),
    },
    {
      id: 'rollback_strategy',
      description: 'Flow possui estratégia de rollback declarada.',
      met: hasRequiredRollbackStrategy(flow),
    },
    {
      id: 'drift_coverage',
      description: 'Flow possui profile de drift registrado.',
      met: hasRequiredDriftCoverage(flow),
    },
    {
      id: 'observability_coverage',
      description: 'Flow possui side effects de observabilidade adequados.',
      met: hasRequiredObservability(flow),
    },
  ];
}
