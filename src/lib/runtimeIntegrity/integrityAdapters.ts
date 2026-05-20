/**
 * Fase 1.8.5 — Integrity adapters (READ-ONLY, inert).
 *
 * Convertem entradas opacas das camadas irmãs em camadas de integridade.
 * Sem side-effects.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { IntegrityLayerKind, RuntimeIntegrityLayer } from './integrityTypes';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function buildLayer(flow: FlowId, kind: IntegrityLayerKind, intact: boolean, gaps: number, score: number): RuntimeIntegrityLayer {
  return { flow, kind, intact, gaps, score: Math.max(0, Math.min(1, score)) };
}

export function fromRuntimeStability(input: { flow: FlowId; envelope?: unknown }): RuntimeIntegrityLayer {
  const e = asRecord(input.envelope);
  const score = typeof e.score === 'number' ? e.score : 1;
  const intact = e.classification === 'stable';
  const gaps = intact ? 0 : 1;
  return buildLayer(input.flow, 'stability', intact, gaps, score);
}

export function fromRuntimeCausality(input: { flow: FlowId; graph?: unknown }): RuntimeIntegrityLayer {
  const g = asRecord(input.graph);
  const intact = g.classification === 'isolated' || g.classification === 'dependent';
  return buildLayer(input.flow, 'causality', intact, intact ? 0 : 1, intact ? 1 : 0.5);
}

export function fromRuntimeReplay(input: { flow: FlowId; replay?: unknown }): RuntimeIntegrityLayer {
  const r = asRecord(input.replay);
  const intact = r.classification === 'deterministic';
  return buildLayer(input.flow, 'replay', intact, intact ? 0 : 1, intact ? 1 : 0.6);
}

export function fromRuntimeHistory(input: { flow: FlowId; history?: unknown }): RuntimeIntegrityLayer {
  const h = asRecord(input.history);
  const intact = h.lineageBroken !== true;
  return buildLayer(input.flow, 'history', intact, intact ? 0 : 1, intact ? 1 : 0.7);
}

export function fromRuntimeRecorder(input: { flow: FlowId; trace?: unknown }): RuntimeIntegrityLayer {
  const t = asRecord(input.trace);
  const intact = t.consistency !== 'orphaned';
  return buildLayer(input.flow, 'recorder', intact, intact ? 0 : 1, intact ? 1 : 0.6);
}

export function fromRuntimeCertification(input: { flow: FlowId; certification?: unknown }): RuntimeIntegrityLayer {
  const c = asRecord(input.certification);
  const intact = c.parityCertified !== false;
  return buildLayer(input.flow, 'certification', intact, intact ? 0 : 1, intact ? 1 : 0.5);
}
