/**
 * Fase 1.8.5 — Integrity explainers (READ-ONLY).
 */

import type {
  IntegrityClassification,
  IntegrityContainment,
  IntegrityIsolation,
  IntegrityPropagationKind,
} from './integrityTypes';

export function explainIntegrityClassification(c: IntegrityClassification): string {
  switch (c) {
    case 'intact': return 'Integridade preservada em todas as camadas.';
    case 'degraded': return 'Integridade levemente degradada — monitorar.';
    case 'unstable': return 'Integridade instável — múltiplos sinais de risco.';
    case 'compromised': return 'Integridade comprometida — cascata em andamento.';
    case 'collapsed': return 'Integridade colapsada — contenção excedida.';
  }
}

export function explainContainmentRisk(c: IntegrityContainment): string {
  switch (c) {
    case 'contained': return 'Falhas contidas dentro do envelope esperado.';
    case 'partially_contained': return 'Contenção parcial — vazamento marginal.';
    case 'leaking': return 'Contenção vazando para camadas adjacentes.';
    case 'cascading': return 'Cascata em propagação — risco alto.';
    case 'unbounded': return 'Contenção excedida — risco crítico.';
  }
}

export function explainIsolationIntegrity(i: IntegrityIsolation): string {
  switch (i) {
    case 'isolated': return 'Camada isolada de outros envelopes.';
    case 'boundary_shared': return 'Boundary compartilhada com camada irmã.';
    case 'mirror_exposed': return 'Mirrors expostos a vazamentos.';
    case 'replay_exposed': return 'Replay exposto — risco de regressão temporal.';
    case 'globally_exposed': return 'Exposição global — sem isolamento efetivo.';
  }
}

export function explainPropagationIntegrity(k: IntegrityPropagationKind): string {
  switch (k) {
    case 'owner': return 'Propagação a partir do owner.';
    case 'mirrors': return 'Propagação via mirrors.';
    case 'finalize': return 'Propagação na fase de finalização.';
    case 'onboarding': return 'Propagação nos passos de onboarding.';
    case 'progress': return 'Propagação no progresso observado.';
    case 'avatar': return 'Propagação na sincronização de avatar.';
    case 'admin': return 'Propagação em ações administrativas.';
    case 'replay': return 'Propagação via replay reconstruído.';
    case 'causality': return 'Propagação via grafo de causalidade.';
    case 'stability': return 'Propagação via envelope de estabilidade.';
    case 'eventual_sync': return 'Propagação em sincronização eventual.';
  }
}

export function explainIntegrityTopology(gapCount: number, recursive: boolean): string {
  if (recursive) return 'Topologia recursiva detectada — não promover.';
  if (gapCount === 0) return 'Topologia íntegra entre camadas.';
  if (gapCount === 1) return 'Uma camada com gap de integridade.';
  return `${gapCount} camadas com gaps de integridade.`;
}
