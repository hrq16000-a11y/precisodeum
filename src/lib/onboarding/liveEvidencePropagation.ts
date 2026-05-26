/**
 * Live Evidence Propagation
 * ─────────────────────────────────────────────────────────────────────────────
 * Rastreia como um único sinal operacional se propaga através do ecossistema
 * de engines (reality → evidence → governance → hardening → memory → selfAudit
 * → correlation). Pure, deterministic, read-only.
 */

import type { RuntimeSignal } from './runtimeSignalAdapter';

export type EngineNode =
  | 'reality'
  | 'evidence'
  | 'governance'
  | 'hardening'
  | 'memory'
  | 'selfAudit'
  | 'correlation';

export const PROPAGATION_NODES: EngineNode[] = [
  'reality',
  'evidence',
  'governance',
  'hardening',
  'memory',
  'selfAudit',
  'correlation',
];

export type PropagationAnomalyId =
  | 'recursive_failure_chain'
  | 'hidden_signal_loss'
  | 'delayed_visibility'
  | 'false_consensus'
  | 'asymmetric_propagation'
  | 'evidence_suppression'
  | 'silent_engine_divergence'
  | 'stale_signal_branch';

export interface SignalPropagationTrace {
  signalId: string;
  source: string;
  severity: string;
  reachedEngines: EngineNode[];
  missedEngines: EngineNode[];
  latencyMs: number; // 0 quando síncrono / não datado
  depth: number;
}

export interface LivePropagationMatrix {
  engines: EngineNode[];
  matrix: number[][]; // matrix[i][j] = sinais que tocaram engines[i] e engines[j]
  totals: Record<EngineNode, number>;
}

export interface PropagationAnomaly {
  id: PropagationAnomalyId;
  signalId?: string;
  engines?: EngineNode[];
  severity: 'info' | 'low' | 'medium' | 'high';
  note: string;
}

export interface PropagationReport {
  traces: SignalPropagationTrace[];
  matrix: LivePropagationMatrix;
  anomalies: PropagationAnomaly[];
}

// Mapeamento determinístico: qual sinal alcança quais engines.
// Heurística estrutural baseada em kind/source/severity.
function reachedEnginesFor(s: RuntimeSignal): EngineNode[] {
  const r = new Set<EngineNode>();
  if (s.kind === 'event' || s.kind === 'behavioral') r.add('reality');
  if (s.kind === 'incident') {
    r.add('reality');
    r.add('memory');
    r.add('hardening');
  }
  if (s.kind === 'release') r.add('memory');
  if (s.kind === 'experiment') r.add('governance');
  if (s.severity === 'high' || s.severity === 'critical') {
    r.add('evidence');
    r.add('correlation');
  }
  if (s.partial) r.add('selfAudit');
  // Qualquer sinal toca correlation
  r.add('correlation');
  return [...r];
}

export function traceSignalPropagation(
  signals: ReadonlyArray<RuntimeSignal>,
): SignalPropagationTrace[] {
  return signals.map((s) => {
    const reached = reachedEnginesFor(s);
    const missed = PROPAGATION_NODES.filter((n) => !reached.includes(n));
    return {
      signalId: s.id,
      source: s.source,
      severity: s.severity,
      reachedEngines: reached,
      missedEngines: missed,
      latencyMs: 0,
      depth: reached.length,
    };
  });
}

export function buildLivePropagationMatrix(
  traces: ReadonlyArray<SignalPropagationTrace>,
): LivePropagationMatrix {
  const n = PROPAGATION_NODES.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const totals: Record<EngineNode, number> = {} as Record<EngineNode, number>;
  for (const node of PROPAGATION_NODES) totals[node] = 0;
  for (const t of traces) {
    for (const e of t.reachedEngines) totals[e]++;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (t.reachedEngines.includes(PROPAGATION_NODES[i]) && t.reachedEngines.includes(PROPAGATION_NODES[j])) {
          matrix[i][j]++;
        }
      }
    }
  }
  return { engines: [...PROPAGATION_NODES], matrix, totals };
}

export function detectPropagationAnomalies(
  signals: ReadonlyArray<RuntimeSignal>,
  traces: ReadonlyArray<SignalPropagationTrace>,
  matrix: LivePropagationMatrix,
): PropagationAnomaly[] {
  const anomalies: PropagationAnomaly[] = [];
  const signalById = new Map(signals.map((s) => [s.id, s]));

  // hidden_signal_loss — críticos que não chegaram em evidence
  for (const t of traces) {
    const s = signalById.get(t.signalId);
    if (!s) continue;
    if ((s.severity === 'critical' || s.severity === 'high') && !t.reachedEngines.includes('evidence')) {
      anomalies.push({
        id: 'hidden_signal_loss',
        signalId: t.signalId,
        engines: ['evidence'],
        severity: 'high',
        note: 'critical signal not reaching evidence',
      });
    }
    // asymmetric_propagation — toca reality mas não correlation
    if (t.reachedEngines.includes('reality') && !t.reachedEngines.includes('correlation')) {
      anomalies.push({
        id: 'asymmetric_propagation',
        signalId: t.signalId,
        engines: ['reality', 'correlation'],
        severity: 'medium',
        note: 'reality without correlation echo',
      });
    }
    // stale_signal_branch — depth==1 e severidade alta
    if (t.depth === 1 && (s.severity === 'high' || s.severity === 'critical')) {
      anomalies.push({
        id: 'stale_signal_branch',
        signalId: t.signalId,
        severity: 'medium',
        note: 'high severity signal with depth=1',
      });
    }
  }

  // false_consensus — TODOS os sinais tocam correlation mas evidence quase nunca
  const totalCorrelation = matrix.totals.correlation;
  const totalEvidence = matrix.totals.evidence;
  if (totalCorrelation > 10 && totalEvidence === 0) {
    anomalies.push({
      id: 'false_consensus',
      engines: ['correlation', 'evidence'],
      severity: 'high',
      note: 'correlation populated but evidence empty',
    });
  }

  // evidence_suppression — proporção evidence/total < 5% com sinais críticos
  const crit = signals.filter((s) => s.severity === 'critical').length;
  if (crit >= 3 && totalEvidence / Math.max(1, signals.length) < 0.05) {
    anomalies.push({
      id: 'evidence_suppression',
      engines: ['evidence'],
      severity: 'high',
      note: 'critical signals not surfacing in evidence',
    });
  }

  // silent_engine_divergence — node com zero registros enquanto outros vão bem
  const max = Math.max(...PROPAGATION_NODES.map((n) => matrix.totals[n]));
  for (const node of PROPAGATION_NODES) {
    if (max > 5 && matrix.totals[node] === 0) {
      anomalies.push({
        id: 'silent_engine_divergence',
        engines: [node],
        severity: 'medium',
        note: `engine ${node} silent while others active`,
      });
    }
  }

  // recursive_failure_chain — mais de 5 sinais críticos sequenciais na mesma fase
  const byPhase: Record<string, RuntimeSignal[]> = {};
  for (const s of signals) {
    if (s.severity === 'critical' || s.severity === 'high') {
      const p = s.phase ?? '_';
      (byPhase[p] = byPhase[p] || []).push(s);
    }
  }
  for (const [phase, list] of Object.entries(byPhase)) {
    if (list.length >= 5) {
      anomalies.push({
        id: 'recursive_failure_chain',
        severity: 'high',
        note: `recursive failures in phase=${phase} (${list.length})`,
      });
    }
  }

  // delayed_visibility — sinais com at=0 + alta severidade
  for (const s of signals) {
    if (s.at === 0 && (s.severity === 'high' || s.severity === 'critical')) {
      anomalies.push({
        id: 'delayed_visibility',
        signalId: s.id,
        severity: 'low',
        note: 'signal without timestamp',
      });
    }
  }

  return anomalies;
}

export function buildEvidencePropagationReport(
  signals: ReadonlyArray<RuntimeSignal>,
): PropagationReport {
  const traces = traceSignalPropagation(signals);
  const matrix = buildLivePropagationMatrix(traces);
  const anomalies = detectPropagationAnomalies(signals, traces, matrix);
  return { traces, matrix, anomalies };
}
