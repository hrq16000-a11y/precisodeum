/**
 * Live Operational Mirror
 * ─────────────────────────────────────────────────────────────────────────────
 * Snapshot consolidado do ecossistema operacional. Combina adoption + propagation
 * + lineage + blind-spots em um único shape determinístico para o painel admin.
 */

import type { RuntimeSignal } from './runtimeSignalAdapter';
import { adoptEngines, type AdoptEnginesResult } from './engineAdoptionLayer';
import {
  buildEvidencePropagationReport,
  type PropagationReport,
} from './liveEvidencePropagation';
import { buildSignalLineage, type LineageReport } from './signalLineage';
import {
  detectOperationalBlindSpots,
  type BlindSpotReport,
} from './operationalBlindSpots';

export interface OperationalMirrorScores {
  mirror_integrity: number;
  propagation_integrity: number;
  systemic_visibility: number;
  runtime_alignment: number;
  operational_maturity: number;
}

export interface OperationalMirror {
  generatedAt: number;
  runtimeState: {
    totalSignals: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    adoption: AdoptEnginesResult;
  };
  activeRisks: Array<{ id: string; severity: string; note: string }>;
  evidenceHealth: {
    coverage: number;
    contradictions: number;
    confirmations: number;
  };
  propagationHealth: {
    avgDepth: number;
    anomalies: number;
    matrixDensity: number;
  };
  consensusHealth: {
    agreementRatio: number; // 0..1
    silentEngines: string[];
  };
  scores: OperationalMirrorScores;
  unstableDomains: string[];
  hiddenClusters: string[];
  blindZones: string[];
  propagation: PropagationReport;
  lineage: LineageReport;
  blindSpots: BlindSpotReport;
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

export function buildOperationalMirror(
  signals: ReadonlyArray<RuntimeSignal>,
  nowMs?: number,
): OperationalMirror {
  const now = nowMs ?? Date.now();
  const adoption = adoptEngines({ runtimeSignals: signals }, now);
  const propagation = buildEvidencePropagationReport(signals);
  const lineage = buildSignalLineage(signals);
  const blindSpots = detectOperationalBlindSpots(signals, propagation);

  const bySeverity: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const s of signals) {
    bySeverity[s.severity] = (bySeverity[s.severity] || 0) + 1;
    bySource[s.source] = (bySource[s.source] || 0) + 1;
  }

  const totalSignals = signals.length;
  const partial = signals.filter((s) => s.partial).length;
  const integrity = totalSignals === 0 ? 0 : ((totalSignals - partial) / totalSignals) * 100;

  const avgDepth =
    propagation.traces.length === 0
      ? 0
      : propagation.traces.reduce((a, t) => a + t.depth, 0) / propagation.traces.length;

  const matrixSum = propagation.matrix.matrix.flat().reduce((a, b) => a + b, 0);
  const matrixMax = propagation.matrix.engines.length * propagation.matrix.engines.length * Math.max(1, totalSignals);
  const matrixDensity = matrixMax === 0 ? 0 : Math.min(1, matrixSum / matrixMax);

  const silentEngines = propagation.anomalies
    .filter((a) => a.id === 'silent_engine_divergence')
    .flatMap((a) => a.engines ?? []);
  const agreementRatio = silentEngines.length === 0 ? 1 : 1 - silentEngines.length / propagation.matrix.engines.length;

  const activeRisks = [
    ...propagation.anomalies
      .filter((a) => a.severity === 'high')
      .map((a) => ({ id: a.id, severity: a.severity, note: a.note })),
    ...lineage.lineageBreaks.map((b) => ({ id: 'lineage_break', severity: 'medium', note: b.reason })),
  ];

  const unstableDomains = [...new Set(propagation.anomalies.flatMap((a) => a.engines ?? []))];
  const hiddenClusters = lineage.unresolvedSignals.slice(0, 10).map((u) => u.signalId);
  const blindZones = blindSpots.blindSpots.map((b) => b.area);

  const scores: OperationalMirrorScores = {
    mirror_integrity: clamp(integrity),
    propagation_integrity: clamp(100 - propagation.anomalies.length * 5),
    systemic_visibility: clamp(blindSpots.blindSpotScore),
    runtime_alignment: clamp(agreementRatio * 100),
    operational_maturity: clamp(
      0.3 * integrity +
        0.25 * (100 - propagation.anomalies.length * 5) +
        0.25 * blindSpots.blindSpotScore +
        0.2 * agreementRatio * 100,
    ),
  };

  return {
    generatedAt: now,
    runtimeState: { totalSignals, bySeverity, bySource, adoption },
    activeRisks,
    evidenceHealth: {
      coverage: clamp(Object.keys(bySource).length * 10),
      contradictions: propagation.anomalies.filter((a) => a.id === 'false_consensus').length,
      confirmations: propagation.traces.filter((t) => t.depth >= 3).length,
    },
    propagationHealth: { avgDepth, anomalies: propagation.anomalies.length, matrixDensity },
    consensusHealth: { agreementRatio, silentEngines },
    scores,
    unstableDomains,
    hiddenClusters,
    blindZones,
    propagation,
    lineage,
    blindSpots,
  };
}
