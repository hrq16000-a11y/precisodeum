import type {
  GovernanceSeal,
  LayerSnapshot,
  MeshCertification,
  MeshCertificationLevel,
  MeshConsensus,
  MeshContainment,
  MeshIsolationState,
  MeshTopology,
} from './meshTypes';

export function certifyGovernanceIntegrity(seal: GovernanceSeal): boolean {
  return seal.intact && seal.strength === 'full';
}

export function certifyIsolationIntegrity(iso: MeshIsolationState): boolean {
  return iso.mode === 'fully_isolated' || iso.mode === 'contained';
}

export function certifyContainmentIntegrity(c: MeshContainment): boolean {
  return c.mode === 'sealed' && !c.escapeDetected && c.envelopeStable;
}

export function certifyConsensusIntegrity(c: MeshConsensus): boolean {
  return (c.level === 'unanimous' || c.level === 'majority') && !c.gap;
}

export function certifyImmutableIntegrity(layers: readonly LayerSnapshot[]): boolean {
  return layers.every(
    (l) =>
      l.stage === 'STAGE_0_READ_ONLY' &&
      !l.liveExecutionEnabled &&
      !l.retryEnabled &&
      !l.backgroundEnabled &&
      !l.realUsersAllowed,
  );
}

export function classifyMeshCertification(args: {
  governanceOk: boolean;
  isolationOk: boolean;
  containmentOk: boolean;
  consensusOk: boolean;
  immutableOk: boolean;
  topology: MeshTopology;
}): MeshCertificationLevel {
  const { governanceOk, isolationOk, containmentOk, consensusOk, immutableOk, topology } = args;
  if (!immutableOk || topology.collapsed || topology.cycles.length > 0) return 'blocked';
  const okCount = [governanceOk, isolationOk, containmentOk, consensusOk, immutableOk].filter(
    Boolean,
  ).length;
  if (okCount === 5 && topology.state === 'stable') return 'full';
  if (okCount >= 4) return 'partial';
  if (okCount >= 2) return 'conditional';
  return 'blocked';
}

export function buildMeshCertification(args: {
  layers: readonly LayerSnapshot[];
  seal: GovernanceSeal;
  isolation: MeshIsolationState;
  containment: MeshContainment;
  consensus: MeshConsensus;
  topology: MeshTopology;
}): MeshCertification {
  const governanceOk = certifyGovernanceIntegrity(args.seal);
  const isolationOk = certifyIsolationIntegrity(args.isolation);
  const containmentOk = certifyContainmentIntegrity(args.containment);
  const consensusOk = certifyConsensusIntegrity(args.consensus);
  const immutableOk = certifyImmutableIntegrity(args.layers);

  const level = classifyMeshCertification({
    governanceOk,
    isolationOk,
    containmentOk,
    consensusOk,
    immutableOk,
    topology: args.topology,
  });

  const reasons: string[] = [];
  if (!governanceOk) reasons.push('governance_seal_broken');
  if (!isolationOk) reasons.push('isolation_compromised');
  if (!containmentOk) reasons.push('containment_compromised');
  if (!consensusOk) reasons.push('consensus_gap');
  if (!immutableOk) reasons.push('immutable_invariant_broken');
  if (args.topology.collapsed) reasons.push('topology_collapsed');
  if (args.topology.cycles.length > 0) reasons.push('topology_recursive');

  const okCount = [governanceOk, isolationOk, containmentOk, consensusOk, immutableOk].filter(
    Boolean,
  ).length;
  const confidence = Math.max(0, Math.min(1, okCount / 5));

  return {
    level,
    governanceOk,
    isolationOk,
    containmentOk,
    consensusOk,
    immutableOk,
    confidence,
    reasons,
  };
}
