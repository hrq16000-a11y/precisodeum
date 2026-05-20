import type {
  CanonicalRuntimeGraph,
  RuntimeCanonicalViolationCode,
} from './algebraTypes';

export interface AlgebraGuardViolation {
  readonly code: RuntimeCanonicalViolationCode;
  readonly message: string;
}

function v(code: RuntimeCanonicalViolationCode, message: string): AlgebraGuardViolation {
  return Object.freeze({ code, message });
}

export function assertAlgebraReadOnlyInvariants(
  g: CanonicalRuntimeGraph,
): readonly AlgebraGuardViolation[] {
  const out: AlgebraGuardViolation[] = [];
  for (const n of g.nodes) {
    if (
      n.state.liveExecutionEnabled ||
      n.state.retryEnabled ||
      n.state.backgroundEnabled ||
      n.state.realUsersAllowed
    ) {
      out.push(v('ALGEBRA_INVARIANT_BROKEN', `Node ${n.id} broke read-only invariants`));
    }
    if (n.state.stage !== 'STAGE_0_READ_ONLY') {
      out.push(v('ALGEBRA_INVARIANT_BROKEN', `Node ${n.id} stage=${n.state.stage}`));
    }
  }
  return out;
}

export function assertAllAlgebraIntegrity(
  g: CanonicalRuntimeGraph,
): readonly AlgebraGuardViolation[] {
  const collected: AlgebraGuardViolation[] = [];
  collected.push(...assertAlgebraReadOnlyInvariants(g));
  for (const vio of g.violations) collected.push(v(vio.code, vio.message));
  const seen = new Set<string>();
  const unique: AlgebraGuardViolation[] = [];
  for (const x of collected) {
    const key = `${x.code}|${x.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(x);
    }
  }
  return Object.freeze(unique);
}
