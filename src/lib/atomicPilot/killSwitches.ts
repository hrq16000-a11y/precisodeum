/**
 * Fase 1.7.10 — Kill-switch policies (READ-ONLY).
 *
 * Nenhum kill-switch é ativado. Apenas declara quais condições
 * devem disparar um corte de pilot em fase futura.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { getPilotCandidate, buildPilotCandidates } from './pilotCandidates';
import type {
  PilotKillSwitch,
  PilotKillSwitchPolicy,
  PilotRiskLevel,
} from './pilotTypes';

const BASELINE_TRIGGERS: readonly PilotKillSwitch[] = [
  'parity_regression',
  'rollback_failure',
  'drift_explosion',
  'blast_escalation',
  'orphan_emergence',
  'stale_read_spike',
  'mirror_inconsistency',
  'unsafe_promotion',
];

export function buildKillSwitchPolicy(
  flow: FlowId,
): PilotKillSwitchPolicy | null {
  const c = getPilotCandidate(flow);
  if (!c) return null;
  // sensitivity escala com blast radius — mais blast = mais sensível
  const sensitivity: PilotRiskLevel =
    c.blast === 'CRITICAL'
      ? 'CRITICAL'
      : c.blast === 'HIGH'
        ? 'HIGH'
        : c.blast === 'MEDIUM'
          ? 'MEDIUM'
          : 'LOW';
  return {
    flow,
    triggers: [...BASELINE_TRIGGERS],
    sensitivity,
    autoEngage: false, // sempre manual nesta fase
  };
}

export function detectKillSwitchTriggers(flow: FlowId): PilotKillSwitch[] {
  // Nesta fase read-only, nenhum trigger real é detectado.
  // Retorna apenas a lista declarada para o flow.
  return buildKillSwitchPolicy(flow)?.triggers.slice() ?? [];
}

export function calculateKillSwitchSensitivity(flow: FlowId): PilotRiskLevel {
  return buildKillSwitchPolicy(flow)?.sensitivity ?? 'CRITICAL';
}

export function explainKillSwitch(p: PilotKillSwitchPolicy): string {
  return `[KILL] ${p.flow} sensitivity=${p.sensitivity} triggers=${p.triggers.length} auto=${p.autoEngage}`;
}

export function buildAllKillSwitchPolicies(): PilotKillSwitchPolicy[] {
  const out: PilotKillSwitchPolicy[] = [];
  for (const c of buildPilotCandidates()) {
    const p = buildKillSwitchPolicy(c.flow);
    if (p) out.push(p);
  }
  return out;
}
