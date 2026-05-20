/**
 * Fase 1.8.2 — Replay adapters (READ-ONLY, INERT).
 *
 * Apenas leitura. Cada adapter normaliza dados de outras camadas para
 * o formato necessário ao replay builder, sem disparar side-effects.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type { RuntimeHistoryWindow } from '@/lib/runtimeHistory/runtimeHistoryTypes';
import { simulateFlow } from '@/lib/atomicSimulation/simulateAtomicExecution';
import { buildRuntimeCertification } from '@/lib/runtimeCertification/certificationMatrix';
import { calculatePromotionEligibility } from '@/lib/atomicPromotion/promotionEligibility';

export interface ReplayAdapterSummary {
  readonly source: string;
  readonly flow: FlowId;
  readonly samples: number;
  readonly liveExecution: false;
  readonly persisted: false;
  readonly retry: false;
  readonly background: false;
}

export function fromRuntimeRecorder(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReplayAdapterSummary {
  return {
    source: 'runtimeRecorder',
    flow,
    samples: traces.filter((t) => t.flow === flow).length,
    liveExecution: false,
    persisted: false,
    retry: false,
    background: false,
  };
}

export function fromRuntimeHistory(
  window: RuntimeHistoryWindow,
): ReplayAdapterSummary {
  return {
    source: 'runtimeHistory',
    flow: window.flow,
    samples: window.entries.length,
    liveExecution: false,
    persisted: false,
    retry: false,
    background: false,
  };
}

export function fromAtomicSimulation(flow: FlowId): ReplayAdapterSummary {
  const sim = simulateFlow(flow);
  return {
    source: 'atomicSimulation',
    flow,
    samples: sim ? 1 : 0,
    liveExecution: false,
    persisted: false,
    retry: false,
    background: false,
  };
}

export function fromRuntimeCertification(flow: FlowId): ReplayAdapterSummary {
  const cert = buildRuntimeCertification(flow);
  return {
    source: 'runtimeCertification',
    flow,
    samples: cert ? 1 : 0,
    liveExecution: false,
    persisted: false,
    retry: false,
    background: false,
  };
}

export function fromPromotionMatrix(flow: FlowId): ReplayAdapterSummary {
  const elig = calculatePromotionEligibility(flow);
  return {
    source: 'promotionMatrix',
    flow,
    samples: elig ? 1 : 0,
    liveExecution: false,
    persisted: false,
    retry: false,
    background: false,
  };
}
