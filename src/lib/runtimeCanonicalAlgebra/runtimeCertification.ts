import type {
  RuntimeAlgebraTopology,
  RuntimeCanonicalCertification,
  RuntimeDeterminism,
  RuntimeEquivalence,
  RuntimeNode,
  RuntimeNormalization,
  RuntimeReduction,
} from './algebraTypes';

export function certifyCanonicalGraph(args: {
  nodes: readonly RuntimeNode[];
  topology: RuntimeAlgebraTopology;
}): boolean {
  if (args.topology.cycles.length > 0 || args.topology.collapsed) return false;
  return args.nodes.every((n) => n.state.classification !== 'divergent');
}

export function certifyDeterminism(d: RuntimeDeterminism): boolean {
  return d.level === 'strict' || d.level === 'stable';
}

export function certifyEquivalence(eq: RuntimeEquivalence): boolean {
  return eq.falseEquivalences.length === 0;
}

export function certifyNormalization(n: RuntimeNormalization): boolean {
  return n.mode === 'canonical';
}

export function certifyReduction(r: RuntimeReduction): boolean {
  return r.mode !== 'unstable' && r.mode !== 'recursive' && !r.equivalenceMismatch;
}

export function certifyCanonicalIntegrity(args: {
  nodes: readonly RuntimeNode[];
  topology: RuntimeAlgebraTopology;
  determinism: RuntimeDeterminism;
  equivalence: RuntimeEquivalence;
  normalization: RuntimeNormalization;
  reduction: RuntimeReduction;
}): RuntimeCanonicalCertification {
  const graphOk = certifyCanonicalGraph({ nodes: args.nodes, topology: args.topology });
  const determinismOk = certifyDeterminism(args.determinism);
  const equivalenceOk = certifyEquivalence(args.equivalence);
  const normalizationOk = certifyNormalization(args.normalization);
  const reductionOk = certifyReduction(args.reduction);

  // Read-only invariants hard gate.
  const invariantsOk = args.nodes.every(
    (n) =>
      !n.state.liveExecutionEnabled &&
      !n.state.retryEnabled &&
      !n.state.backgroundEnabled &&
      !n.state.realUsersAllowed &&
      n.state.stage === 'STAGE_0_READ_ONLY',
  );

  const reasons: string[] = [];
  if (!graphOk) reasons.push('graph_topology_unstable');
  if (!determinismOk) reasons.push('determinism_violated');
  if (!equivalenceOk) reasons.push('equivalence_invalid');
  if (!normalizationOk) reasons.push('normalization_failed');
  if (!reductionOk) reasons.push('reduction_unstable');
  if (!invariantsOk) reasons.push('readonly_invariants_broken');
  if (args.topology.cycles.length > 0) reasons.push('recursive_propagation');

  let level: RuntimeCanonicalCertification['level'];
  if (!invariantsOk || args.topology.cycles.length > 0 || args.topology.collapsed) {
    level = 'blocked';
  } else {
    const okCount = [graphOk, determinismOk, equivalenceOk, normalizationOk, reductionOk].filter(
      Boolean,
    ).length;
    if (okCount === 5 && args.topology.state === 'stable') level = 'full';
    else if (okCount >= 4) level = 'partial';
    else if (okCount >= 2) level = 'conditional';
    else level = 'blocked';
  }

  const okCount = [graphOk, determinismOk, equivalenceOk, normalizationOk, reductionOk].filter(
    Boolean,
  ).length;
  const confidence = Math.max(0, Math.min(1, okCount / 5));

  return Object.freeze({
    level,
    graphOk,
    determinismOk,
    equivalenceOk,
    normalizationOk,
    reductionOk,
    confidence,
    reasons: Object.freeze(reasons),
  });
}
