/**
 * Fase 1.9.3 — Explainers (READ-ONLY, pure strings).
 */
import type {
  EquilibriumClass,
  MetastableState,
  RuntimeDissipationEnvelope,
  RuntimeEntropyEnvelope,
  RuntimePropagationEnergy,
  RuntimeTopologyTension,
} from './equilibriumTypes';

export function explainEquilibrium(c: EquilibriumClass): string {
  switch (c) {
    case 'STABLE': return 'Equilíbrio estável: tensão contida e energia dissipada.';
    case 'META_STABLE': return 'Equilíbrio metaestável: estabilidade temporária sob ruído.';
    case 'TRANSIENT': return 'Equilíbrio transiente: alta entropia, propagação ativa.';
    case 'FRACTURED': return 'Equilíbrio fraturado: topologia partida ou propagação ilimitada.';
    case 'COLLAPSED': return 'Equilíbrio colapsado: campo e topologia destruídos.';
  }
}

export function explainEntropy(e: RuntimeEntropyEnvelope): string {
  return `Entropia ${e.level} (score=${e.score.toFixed(3)})${e.escalating ? ' escalando' : ''}${e.collapsed ? ' colapsada' : ''}.`;
}

export function explainPropagationEnergy(p: RuntimePropagationEnergy): string {
  return `Propagação ${p.energy} amp=${p.amplitude.toFixed(3)} contenção=${p.containment.toFixed(3)}${p.unbounded ? ' UNBOUNDED' : ''}.`;
}

export function explainTopologyTension(t: RuntimeTopologyTension): string {
  return `Topologia ${t.tension} nodes=${t.nodes} edges=${t.edges} balance=${t.balance.toFixed(3)}.`;
}

export function explainDissipation(d: RuntimeDissipationEnvelope): string {
  return `Dissipação ${d.classification} score=${d.score.toFixed(3)} balance=${d.balance.toFixed(3)}.`;
}

export function explainMetastability(m: MetastableState): string {
  return `Metaestabilidade ${m.metastable ? 'sim' : 'não'} score=${m.score.toFixed(3)}${m.temporary ? ' temporária' : ''}${m.unstable ? ' instável' : ''}.`;
}
