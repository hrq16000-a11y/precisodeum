/**
 * Fase 1.7.9 — RPC contract explainers (PURE strings).
 */

import type {
  RpcConsistencyGuarantee,
  RpcContract,
  RpcIdempotencyContract,
  RpcReadinessReport,
  RpcRollbackContract,
} from './rpcContractTypes';

export function explainRpcContract(c: RpcContract): string {
  return `[RPC] ${c.rpc} flow=${c.flow} owner=${c.ownership} atomicity=${c.atomicity} semantic=${c.executionSemantic} compat=${c.compatibility} live=${c.liveExecutionEnabled}`;
}

export function explainRollbackContract(r: RpcRollbackContract): string {
  return `[ROLLBACK] ${r.flow} strategy=${r.strategy} class=${r.classification} strength=${r.strength} retry=${r.supportsSafeRetry} comp=${r.requiresCompensation}`;
}

export function explainIdempotencyContract(i: RpcIdempotencyContract): string {
  return `[IDEM] ${i.flow} keys=${i.replayKeys.join(',')} replay=${i.deterministicReplay} risks=${i.nonIdempotentRisks.length}`;
}

export function explainConsistencyContract(c: RpcConsistencyGuarantee): string {
  return `[CONS] ${c.flow} strength=${c.strength} mirror=${c.requiresMirrorPropagation} ownership=${c.requiresOwnershipResolution} eventual=${c.supportsEventualConsistency}`;
}

export function explainRpcReadinessReport(r: RpcReadinessReport): string {
  return `[READY] ${r.rpc} score=${r.readinessScore} shadow=${r.shadowReady} pilot=${r.pilotReady} blockers=${r.blockers.length}`;
}
