/**
 * Fase 1.8.3 — Causality adapters (READ-ONLY, inertes).
 *
 * Adapters puramente passivos. Não tocam writers, não chamam executores,
 * apenas devolvem snapshots vazios marcados como inertes.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import { buildFlowCausality } from './causalityGraph';
import type { RuntimeCausalityGraph } from './causalityTypes';

export interface InertCausalityAdapter {
  readonly flow: FlowId;
  readonly source: 'recorder' | 'history' | 'replay' | 'simulation' | 'certification';
  readonly liveExecution: false;
  readonly persisted: false;
  readonly retry: false;
  readonly background: false;
  readonly graph: RuntimeCausalityGraph | null;
}

export function fromRuntimeReplay(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): InertCausalityAdapter {
  return {
    flow, source: 'replay',
    liveExecution: false, persisted: false, retry: false, background: false,
    graph: traces.length > 0 ? buildFlowCausality(flow, traces) : null,
  };
}

export function fromRuntimeHistory(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): InertCausalityAdapter {
  return {
    flow, source: 'history',
    liveExecution: false, persisted: false, retry: false, background: false,
    graph: traces.length > 0 ? buildFlowCausality(flow, traces) : null,
  };
}

export function fromRuntimeRecorder(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): InertCausalityAdapter {
  return {
    flow, source: 'recorder',
    liveExecution: false, persisted: false, retry: false, background: false,
    graph: traces.length > 0 ? buildFlowCausality(flow, traces) : null,
  };
}

export function fromRuntimeSimulation(flow: FlowId): InertCausalityAdapter {
  return {
    flow, source: 'simulation',
    liveExecution: false, persisted: false, retry: false, background: false,
    graph: null,
  };
}

export function fromRuntimeCertification(flow: FlowId): InertCausalityAdapter {
  return {
    flow, source: 'certification',
    liveExecution: false, persisted: false, retry: false, background: false,
    graph: null,
  };
}
