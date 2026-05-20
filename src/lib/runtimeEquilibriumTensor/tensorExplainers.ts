import type { CurvatureClass, InstabilityDensity, RuntimeContainmentField, RuntimeCurvatureEnvelope, RuntimeInstabilityDensityEnvelope, RuntimeSingularityEnvelope, RuntimeTopologyGeometry, SingularityClass, TensorStabilityClass, TopologyDeformation } from './tensorTypes';
export function explainTensorState(c: TensorStabilityClass): string { switch (c) { case 'STABLE': return 'tensor estável e contido'; case 'CURVED': return 'tensor curvado mas dentro de limites'; case 'STRESSED': return 'tensor sob estresse mensurável'; case 'FRACTURED': return 'tensor fraturado em sub-domínios'; case 'SINGULAR': return 'tensor com singularidade detectada'; } }
export function explainCurvature(e: RuntimeCurvatureEnvelope): string { return `curvatura ${e.class.toLowerCase()} (valor=${e.value.toFixed(2)}, contenção=${e.containment.toFixed(2)})`; }
export function explainInstabilityDensity(e: RuntimeInstabilityDensityEnvelope): string { return `densidade ${e.level.toLowerCase()} (score=${e.score.toFixed(2)})`; }
export function explainContainment(c: RuntimeContainmentField): string { return `contenção força=${c.strength.toFixed(2)}, leak=${c.leaking}, fragmentos=${c.fragments}`; }
export function explainTopologyDeformation(t: RuntimeTopologyGeometry): string { return `deformação ${t.deformation.toLowerCase()} (stress=${t.stress.toFixed(2)})`; }
export function explainSingularity(s: RuntimeSingularityEnvelope): string { return `singularidade ${s.class.toLowerCase()} (raio=${s.radius.toFixed(2)})`; }
export function explainCurvatureClass(c: CurvatureClass): string { return c.toLowerCase(); }
export function explainDensityLevel(l: InstabilityDensity): string { return l.toLowerCase(); }
export function explainDeformation(d: TopologyDeformation): string { return d.toLowerCase(); }
export function explainSingularityClass(s: SingularityClass): string { return s.toLowerCase(); }
