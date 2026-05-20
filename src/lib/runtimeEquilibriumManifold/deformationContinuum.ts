import type { DeformationContinuum, ManifoldNode, RuntimeDeformationContinuum } from './manifoldTypes';
export function calculateDeformationPressure(nodes: readonly ManifoldNode[]): number { if (nodes.length === 0) return 0; return nodes.reduce((a, n) => a + Math.abs(n.tension) - n.elasticity, 0) / nodes.length; }
export function detectElasticRecovery(nodes: readonly ManifoldNode[]): boolean { if (nodes.length === 0) return true; return nodes.every((n) => n.elasticity >= Math.abs(n.tension) / 2); }
export function detectIrreversibleDeformation(nodes: readonly ManifoldNode[]): boolean { return nodes.some((n) => Math.abs(n.tension) > 8 && n.elasticity < 1); }
export function buildDeformationContinuum(nodes: readonly ManifoldNode[]): RuntimeDeformationContinuum {
  const pressure = calculateDeformationPressure(nodes);
  const elastic = detectElasticRecovery(nodes);
  const irreversible = detectIrreversibleDeformation(nodes);
  let deformation: DeformationContinuum = 'NONE';
  if (irreversible) deformation = 'IRREVERSIBLE'; else if (pressure > 5) deformation = 'FRACTURED'; else if (pressure > 1) deformation = 'DISTRIBUTED'; else if (pressure > 0) deformation = 'ELASTIC';
  return Object.freeze({ deformation, pressure, elastic, irreversible });
}
