/**
 * Fase 1.7.7 — Divergence detection (READ-ONLY).
 *
 * Classifica diferenças estruturais entre o plano legacy e o plano atomic
 * para cada flow. NUNCA toca em dados reais.
 */

import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { buildOperationBlueprint } from '@/lib/atomicBlueprint/operationBlueprints';
import type {
  DivergenceEntry,
  DivergenceKind,
  DivergenceReport,
  DivergenceSeverity,
} from './simulationTypes';
import { simulateFlow } from './simulateAtomicExecution';

const SEVERITY_ORDER: DivergenceSeverity[] = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

function worstSeverity(entries: DivergenceEntry[]): DivergenceSeverity {
  if (entries.length === 0) return 'NONE';
  let worst: DivergenceSeverity = 'NONE';
  for (const e of entries) {
    if (SEVERITY_ORDER.indexOf(e.severity) > SEVERITY_ORDER.indexOf(worst)) {
      worst = e.severity;
    }
  }
  return worst;
}

function add(
  entries: DivergenceEntry[],
  kind: DivergenceKind,
  severity: DivergenceSeverity,
  detail: string,
): void {
  entries.push({ kind, severity, detail });
}

export function detectDivergence(flow: FlowId): DivergenceReport | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const sim = simulateFlow(flow);
  if (!sim) return null;
  const bp = buildOperationBlueprint(reg);
  const profile = getFlowDriftProfile(flow);

  const entries: DivergenceEntry[] = [];

  // field divergence — multi-write expõe estados parciais
  if (reg.steps.length > 1) {
    add(
      entries,
      'field',
      reg.requiresFinalize ? 'HIGH' : 'MEDIUM',
      'legacy expõe campos parciais antes do commit final',
    );
  }

  // ownership divergence
  if (reg.ownership === 'mixed') {
    add(
      entries,
      'ownership',
      'MEDIUM',
      'ownership mista pode ser resolvida fora da boundary legacy',
    );
  }

  // mirror divergence
  if (profile?.depends_on_mirror) {
    add(
      entries,
      'mirror',
      'HIGH',
      'mirror profile<->provider pode propagar fora da boundary legacy',
    );
  }

  // finalize divergence
  if (reg.requiresFinalize) {
    add(
      entries,
      'finalize',
      'HIGH',
      'finalizeOnboarding roda fora do escopo transacional legacy',
    );
  }

  // onboarding divergence
  if (reg.requiresProgressSync) {
    add(
      entries,
      'onboarding',
      'MEDIUM',
      'onboarding_progress sync legado é separado da escrita principal',
    );
  }

  // topology divergence — legacy = sequential, atomic = atomic_required
  if (reg.steps.length > 1) {
    add(
      entries,
      'topology',
      'LOW',
      'topologia legacy sequencial difere da topologia atomica unificada',
    );
  }

  // rollback divergence — legacy não tem rollback nativo
  if (!reg.supportsRollback && reg.steps.length > 1) {
    add(
      entries,
      'rollback',
      reg.requiresFinalize ? 'CRITICAL' : 'HIGH',
      'legacy não suporta rollback automático multi-write',
    );
  }

  // observability divergence — sempre presente até live execution
  add(
    entries,
    'observability',
    'LOW',
    'observabilidade atomica é simulada — emissores legacy permanecem ativos',
  );

  return {
    flow,
    entries,
    worst: worstSeverity(entries),
  };
}

export function detectAllDivergences(): Record<FlowId, DivergenceReport> {
  const out = {} as Record<FlowId, DivergenceReport>;
  for (const r of OPERATION_REGISTRY) {
    const rep = detectDivergence(r.flow);
    if (rep) out[r.flow] = rep;
  }
  return out;
}
