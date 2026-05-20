import type { RuntimeContinuityEnvelope, RuntimeDeformationContinuum, RuntimeManifoldCollapse, RuntimeStabilityContinuum } from './manifoldTypes';
export function calculateCollapsePropagation(c: RuntimeStabilityContinuum): number { return c.collapsed ? 1 : 1 - c.balance; }
export function detectManifoldCollapse(c: RuntimeStabilityContinuum, cont: RuntimeContinuityEnvelope): boolean { return c.collapsed || cont.class === 'COLLAPSED'; }
export function detectCascadeContinuumCollapse(c: RuntimeStabilityContinuum, cont: RuntimeContinuityEnvelope): boolean { return c.collapsed && cont.class === 'COLLAPSED'; }
export function detectIrrecoverableContinuity(def: RuntimeDeformationContinuum, cont: RuntimeContinuityEnvelope): boolean { return def.irreversible && cont.fractured; }
export function buildManifoldCollapse(c: RuntimeStabilityContinuum, cont: RuntimeContinuityEnvelope, def: RuntimeDeformationContinuum): RuntimeManifoldCollapse {
  const collapsing = detectManifoldCollapse(c, cont);
  const cascade = detectCascadeContinuumCollapse(c, cont);
  const irrecoverable = detectIrrecoverableContinuity(def, cont);
  const propagation = calculateCollapsePropagation(c);
  return Object.freeze({ collapsing, cascade, irrecoverable, propagation });
}
