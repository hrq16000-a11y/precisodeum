/**
 * Fase 1.8.4 — Stability adapters (READ-ONLY, inert).
 *
 * Adapters puros, sem side-effects. Convertem entradas opacas das camadas
 * irmãs em estruturas de runtimeStability. Funções aceitam `unknown` para
 * manter desacoplamento e evitar ciclos de import.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeDependencyEdge, RuntimeDependencyNode } from './stabilityTypes';

interface AdaptedNodes {
  readonly flow: FlowId;
  readonly nodes: readonly RuntimeDependencyNode[];
  readonly edges: readonly RuntimeDependencyEdge[];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

export function fromRuntimeCausality(input: { flow: FlowId; graph?: unknown }): AdaptedNodes {
  const g = asRecord(input.graph);
  const topology = asRecord(g.topology);
  const nodes: RuntimeDependencyNode[] = [];
  const owners = Array.isArray(topology.owners) ? (topology.owners as string[]) : [];
  const mirrors = Array.isArray(topology.mirrors) ? (topology.mirrors as string[]) : [];
  const finalizers = Array.isArray(topology.finalizers) ? (topology.finalizers as string[]) : [];
  for (const s of owners) nodes.push({ flow: input.flow, step: s, kind: 'owner', resolved: true, hidden: false });
  for (const s of mirrors) nodes.push({ flow: input.flow, step: s, kind: 'mirror', resolved: true, hidden: false });
  for (const s of finalizers) nodes.push({ flow: input.flow, step: s, kind: 'finalize', resolved: true, hidden: false });
  if (topology.hiddenDependencies === true) {
    nodes.push({ flow: input.flow, step: 'hidden', kind: 'projection', resolved: false, hidden: true });
  }
  return { flow: input.flow, nodes, edges: [] };
}

export function fromRuntimeReplay(input: { flow: FlowId; replay?: unknown }): AdaptedNodes {
  const r = asRecord(input.replay);
  const nodes: RuntimeDependencyNode[] = [];
  if (Array.isArray(r.steps)) {
    for (const s of r.steps as Array<Record<string, unknown>>) {
      nodes.push({
        flow: input.flow,
        step: String(s.step ?? 'unknown'),
        kind: 'replay',
        resolved: s.status === 'ok',
        hidden: false,
      });
    }
  }
  return { flow: input.flow, nodes, edges: [] };
}

export function fromRuntimeHistory(input: { flow: FlowId; history?: unknown }): AdaptedNodes {
  const h = asRecord(input.history);
  const nodes: RuntimeDependencyNode[] = [];
  if (h.lineageBroken === true) {
    nodes.push({ flow: input.flow, step: 'lineage', kind: 'projection', resolved: false, hidden: false });
  }
  return { flow: input.flow, nodes, edges: [] };
}

export function fromRuntimeRecorder(input: { flow: FlowId; trace?: unknown }): AdaptedNodes {
  const t = asRecord(input.trace);
  const nodes: RuntimeDependencyNode[] = [];
  if (Array.isArray(t.steps)) {
    for (const s of t.steps as Array<Record<string, unknown>>) {
      nodes.push({
        flow: input.flow,
        step: String(s.step ?? 'unknown'),
        kind: 'owner',
        resolved: s.status === 'ok',
        hidden: false,
      });
    }
  }
  return { flow: input.flow, nodes, edges: [] };
}

export function fromRuntimeSimulation(input: { flow: FlowId; simulation?: unknown }): AdaptedNodes {
  const s = asRecord(input.simulation);
  const nodes: RuntimeDependencyNode[] = [];
  if (s.expectedOwner) nodes.push({ flow: input.flow, step: 'sim_owner', kind: 'owner', resolved: true, hidden: false });
  if (s.expectedMirror) nodes.push({ flow: input.flow, step: 'sim_mirror', kind: 'mirror', resolved: true, hidden: false });
  return { flow: input.flow, nodes, edges: [] };
}

export function fromRuntimeCertification(input: { flow: FlowId; certification?: unknown }): AdaptedNodes {
  const c = asRecord(input.certification);
  const nodes: RuntimeDependencyNode[] = [];
  if (c.parityCertified === false) {
    nodes.push({ flow: input.flow, step: 'parity', kind: 'projection', resolved: false, hidden: false });
  }
  return { flow: input.flow, nodes, edges: [] };
}
