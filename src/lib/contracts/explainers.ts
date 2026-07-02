/**
 * Fase 1.7.5 — Explainers para contratos (PURE).
 *
 * Strings determinísticas para auditoria humana. Sem UI, sem markdown render.
 */

import type { ArchitecturalContract, MutationPolicyId } from './contractTypes';
import type { DependencyGraph } from './dependencyGraph';
import type { FlowGuarantees, GuaranteeViolation } from './guarantees';
import type { ArchitecturalInvariant, InvariantViolation } from './invariantRegistry';
import { MUTATION_POLICY_CATALOG } from './mutationPolicies';

export function explainInvariant(inv: ArchitecturalInvariant): string {
  return `[INV/${inv.severity.toUpperCase()}/${inv.category}] ${inv.id} :: ${inv.description}`;
}

export function explainInvariantViolation(v: InvariantViolation): string {
  return `[VIOL/${v.severity}] ${v.invariantId} flow=${v.flow} :: ${v.description}`;
}

export function explainContract(c: ArchitecturalContract): string {
  const head = `[CONTRACT/${c.kind}]`;
  const policy = `policy=${c.mutationPolicy}`;
  const readiness = `readiness=${c.requiredReadiness}`;
  const rollback = `rollback=${c.rollbackExpectation}`;
  const guarantees = `guarantees=[${c.guarantees.join(',')}]`;
  let target = '';
  if (c.kind === 'flow') target = `flow=${c.flow} boundary=${c.boundary} owner=${c.ownership}`;
  else if (c.kind === 'boundary') target = `boundary=${c.boundary} flows=${c.flows.length}`;
  else if (c.kind === 'ownership') target = `owner=${c.owner} flows=${c.flows.length}`;
  else if (c.kind === 'execution') target = `mode=${c.mode} flows=${c.flows.length}`;
  else if (c.kind === 'telemetry') target = `flow=${c.flow}`;
  else if (c.kind === 'atomicity') target = `flow=${c.flow} multi=${c.isMultiStep} requires_migration=${c.requiresAtomicMigration}`;
  else if (c.kind === 'mirror') target = `flow=${c.flow} mirror=${c.hasMirror} required=${c.mirrorRequired}`;
  else if (c.kind === 'rollback') target = `flow=${c.flow} supports=${c.supportsRollback}`;
  return `${head} ${target} ${policy} ${readiness} ${rollback} ${guarantees}`;
}

export function explainDependencyGraph(graph: DependencyGraph): string {
  const lines: string[] = [];
  lines.push('=== Dependency Graph ===');
  lines.push(`nodes=${graph.nodes.length} edges=${graph.edges.length}`);
  for (const n of graph.nodes) {
    lines.push(
      `- ${n.flow} boundary=${n.boundary} owner=${n.ownership} readiness=${n.readiness} tracker=${n.hasTracker} mirror=${n.hasMirror} telemetry=${n.hasTelemetry}`,
    );
  }
  return lines.join('\n');
}

export function explainGuaranteeLevel(g: FlowGuarantees): string {
  const parts = Object.entries(g.levels)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  return `[GUAR] ${g.flow} overall=${g.overall} :: ${parts}`;
}

export function explainGuaranteeViolation(v: GuaranteeViolation): string {
  return `[GUAR-VIOL] ${v.flow} guarantee=${v.guarantee} level=${v.level} :: ${v.reason}`;
}

export function explainMutationPolicy(policy: MutationPolicyId): string {
  const def = MUTATION_POLICY_CATALOG[policy];
  return `[POLICY/${policy}] persist=${def.allowsPersistence} owner=${def.requiresOwnership} tracker=${def.requiresTracker} quarantine=${def.requiresQuarantine} :: ${def.description}`;
}
