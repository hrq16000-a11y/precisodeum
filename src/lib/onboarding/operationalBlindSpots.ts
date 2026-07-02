/**
 * Operational Blind-Spot Detector
 * ─────────────────────────────────────────────────────────────────────────────
 * Identifica áreas do onboarding sem observabilidade suficiente.
 * Pure, deterministic, read-only.
 */

import type { RuntimeSignal } from './runtimeSignalAdapter';
import type { PropagationReport } from './liveEvidencePropagation';

export type BlindSpotId =
  | 'invisible_phase'
  | 'low_signal_density'
  | 'untracked_failure_zone'
  | 'telemetry_void'
  | 'weak_consensus_area'
  | 'low_forensic_resolution'
  | 'unstable_runtime_area';

export interface BlindSpot {
  id: BlindSpotId;
  area: string;
  severity: 'low' | 'medium' | 'high';
  signalsObserved: number;
  note: string;
}

export interface BlindSpotReport {
  blindSpots: BlindSpot[];
  unstableAreas: string[];
  confidenceDropZones: string[];
  missingCoverage: string[];
  blindSpotScore: number; // 0..100 (100 = sem blind spots)
}

// Lista mínima canônica de fases observáveis (subset estável; deriva de PHASE_ORDER
// mas não importa para evitar acoplamento).
const KNOWN_PHASES = [
  'phase2_service',
  'phase3_photos',
  'phase4_final',
  'pro_kind',
  'pro_document',
  'pro_location',
  'pro_contact',
];

export function detectOperationalBlindSpots(
  signals: ReadonlyArray<RuntimeSignal>,
  propagation: PropagationReport,
): BlindSpotReport {
  const blindSpots: BlindSpot[] = [];
  const byPhase: Record<string, RuntimeSignal[]> = {};
  for (const s of signals) {
    const p = s.phase ?? '_unknown';
    (byPhase[p] = byPhase[p] || []).push(s);
  }

  // invisible_phase — fase conhecida sem nenhum sinal
  for (const phase of KNOWN_PHASES) {
    if (!byPhase[phase] || byPhase[phase].length === 0) {
      blindSpots.push({
        id: 'invisible_phase',
        area: phase,
        severity: 'medium',
        signalsObserved: 0,
        note: 'known phase produced zero signals',
      });
    }
  }

  // low_signal_density — fase com 1 sinal apenas
  for (const [phase, list] of Object.entries(byPhase)) {
    if (phase === '_unknown') continue;
    if (list.length === 1) {
      blindSpots.push({
        id: 'low_signal_density',
        area: phase,
        severity: 'low',
        signalsObserved: 1,
        note: 'only one signal observed',
      });
    }
  }

  // untracked_failure_zone — fase com severity critical sem evidence reach
  for (const [phase, list] of Object.entries(byPhase)) {
    const crits = list.filter((s) => s.severity === 'critical');
    const evReached = propagation.traces.some(
      (t) => t.reachedEngines.includes('evidence') && list.some((s) => s.id === t.signalId),
    );
    if (crits.length > 0 && !evReached) {
      blindSpots.push({
        id: 'untracked_failure_zone',
        area: phase,
        severity: 'high',
        signalsObserved: crits.length,
        note: 'critical signals without evidence reach',
      });
    }
  }

  // telemetry_void — total de sinais < 5
  if (signals.length < 5) {
    blindSpots.push({
      id: 'telemetry_void',
      area: 'global',
      severity: 'high',
      signalsObserved: signals.length,
      note: 'global telemetry volume too low',
    });
  }

  // weak_consensus_area — silent engines presentes
  const silent = propagation.anomalies.filter((a) => a.id === 'silent_engine_divergence');
  for (const s of silent) {
    for (const e of s.engines ?? []) {
      blindSpots.push({
        id: 'weak_consensus_area',
        area: e,
        severity: 'medium',
        signalsObserved: 0,
        note: 'engine silent in propagation matrix',
      });
    }
  }

  // low_forensic_resolution — proporção alta de sinais sem session_id
  const noSession = signals.filter((s) => !s.session_id).length;
  if (signals.length > 0 && noSession / signals.length > 0.3) {
    blindSpots.push({
      id: 'low_forensic_resolution',
      area: 'global',
      severity: 'medium',
      signalsObserved: noSession,
      note: `${noSession}/${signals.length} signals without session_id`,
    });
  }

  // unstable_runtime_area — fase com error rate >40%
  for (const [phase, list] of Object.entries(byPhase)) {
    if (list.length < 3) continue;
    const errs = list.filter((s) => s.severity === 'high' || s.severity === 'critical').length;
    if (errs / list.length > 0.4) {
      blindSpots.push({
        id: 'unstable_runtime_area',
        area: phase,
        severity: 'high',
        signalsObserved: errs,
        note: `error rate ${Math.round((errs / list.length) * 100)}%`,
      });
    }
  }

  const unstableAreas = [...new Set(blindSpots.filter((b) => b.id === 'unstable_runtime_area').map((b) => b.area))];
  const confidenceDropZones = [
    ...new Set(blindSpots.filter((b) => b.id === 'low_signal_density' || b.id === 'low_forensic_resolution').map((b) => b.area)),
  ];
  const missingCoverage = [...new Set(blindSpots.filter((b) => b.id === 'invisible_phase').map((b) => b.area))];

  const score = Math.max(0, 100 - blindSpots.length * 8);
  return { blindSpots, unstableAreas, confidenceDropZones, missingCoverage, blindSpotScore: score };
}
