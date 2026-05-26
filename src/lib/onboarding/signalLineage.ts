/**
 * Signal Lineage Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Rastreia origem → propagação → impacto → consenso de cada sinal. Read-only,
 * determinístico. Não escreve em lugar nenhum.
 */

import type { RuntimeSignal } from './runtimeSignalAdapter';

export type LineageBreakId =
  | 'lineage_break'
  | 'orphan_branch'
  | 'circular_propagation'
  | 'duplicate_signal_path'
  | 'hidden_source'
  | 'unresolved_runtime_path';

export interface LineageChain {
  rootSignalId: string;
  source: string;
  phase: string | null;
  steps: Array<{ signalId: string; at: number; kind: string; severity: string }>;
  resolved: boolean;
  /** "ok" | "broken" | "unresolved" */
  status: 'ok' | 'broken' | 'unresolved';
}

export interface LineageBreak {
  id: LineageBreakId;
  signalId?: string;
  reason: string;
}

export interface UnresolvedSignal {
  signalId: string;
  reason: string;
}

export interface DuplicatePath {
  pathKey: string;
  count: number;
  signalIds: string[];
}

export interface LineageReport {
  lineageChains: LineageChain[];
  lineageBreaks: LineageBreak[];
  unresolvedSignals: UnresolvedSignal[];
  duplicatedPaths: DuplicatePath[];
  lineageIntegrity: number; // 0..100
}

export function buildSignalLineage(signals: ReadonlyArray<RuntimeSignal>): LineageReport {
  const chains: LineageChain[] = [];
  const breaks: LineageBreak[] = [];
  const unresolved: UnresolvedSignal[] = [];
  const pathCounter = new Map<string, string[]>();

  // Agrupa por session_id (cadeia natural)
  const bySession = new Map<string | '_orphan', RuntimeSignal[]>();
  for (const s of signals) {
    const k = s.session_id ?? '_orphan';
    if (!bySession.has(k)) bySession.set(k, []);
    bySession.get(k)!.push(s);
  }

  for (const [sid, list] of bySession) {
    const sorted = [...list].sort((a, b) => a.at - b.at);
    const root = sorted[0];
    if (!root) continue;

    if (sid === '_orphan') {
      for (const s of sorted) {
        breaks.push({ id: 'orphan_branch', signalId: s.id, reason: 'no session_id' });
        unresolved.push({ signalId: s.id, reason: 'orphan' });
      }
      continue;
    }

    const steps = sorted.map((s) => ({
      signalId: s.id,
      at: s.at,
      kind: s.kind,
      severity: s.severity,
    }));

    let status: LineageChain['status'] = 'ok';
    let resolved = true;

    // hidden_source — root sem timestamp
    if (root.at === 0) {
      breaks.push({ id: 'hidden_source', signalId: root.id, reason: 'root without timestamp' });
      status = 'broken';
      resolved = false;
    }

    // unresolved_runtime_path — última step é severity high+ sem follow-up
    const last = sorted[sorted.length - 1];
    if (last && (last.severity === 'high' || last.severity === 'critical') && sorted.length === 1) {
      unresolved.push({ signalId: last.id, reason: 'no follow-up after high severity' });
      breaks.push({
        id: 'unresolved_runtime_path',
        signalId: last.id,
        reason: 'high severity isolated',
      });
      status = status === 'broken' ? 'broken' : 'unresolved';
      resolved = false;
    }

    // circular_propagation — mesma categoria repete ≥3x consecutivamente
    let runCat = '';
    let runLen = 0;
    for (const s of sorted) {
      const c = s.category ?? s.kind;
      if (c === runCat) {
        runLen++;
        if (runLen === 3) {
          breaks.push({
            id: 'circular_propagation',
            signalId: s.id,
            reason: `category ${c} repeated 3x`,
          });
          status = 'broken';
        }
      } else {
        runCat = c;
        runLen = 1;
      }
    }

    // duplicate_signal_path — chave por (phase|category|severity)
    const pathKey = sorted.map((s) => `${s.phase ?? '_'}|${s.category ?? s.kind}|${s.severity}`).join('>');
    if (!pathCounter.has(pathKey)) pathCounter.set(pathKey, []);
    pathCounter.get(pathKey)!.push(root.id);

    chains.push({ rootSignalId: root.id, source: root.source, phase: root.phase, steps, resolved, status });
  }

  const duplicatedPaths: DuplicatePath[] = [];
  for (const [pathKey, ids] of pathCounter) {
    if (ids.length >= 3) {
      duplicatedPaths.push({ pathKey, count: ids.length, signalIds: ids });
      breaks.push({
        id: 'duplicate_signal_path',
        reason: `path repeated ${ids.length}x`,
      });
    }
  }

  // lineage_break agregado quando >10% chains com status broken
  const broken = chains.filter((c) => c.status === 'broken').length;
  if (chains.length > 0 && broken / chains.length > 0.1) {
    breaks.push({ id: 'lineage_break', reason: `${broken}/${chains.length} chains broken` });
  }

  const total = chains.length || 1;
  const okCount = chains.filter((c) => c.status === 'ok').length;
  const lineageIntegrity = Math.round((okCount / total) * 100);

  return { lineageChains: chains, lineageBreaks: breaks, unresolvedSignals: unresolved, duplicatedPaths, lineageIntegrity };
}
