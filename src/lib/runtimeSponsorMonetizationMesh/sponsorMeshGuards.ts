/**
 * Phase 1.9.14 — Integrity guards. Read-only invariants enforcement.
 */
import type {
  SponsorAllocationPolicy,
  SponsorExposureEvent,
  SponsorMeshSnapshot,
  SponsorNode,
} from './sponsorMeshTypes';
import { SPONSOR_MESH_INTERNALS } from './sponsorMeshInternals';

export class SponsorMeshIntegrityError extends Error {
  constructor(message: string) {
    super(`[sponsor-mesh] ${message}`);
    this.name = 'SponsorMeshIntegrityError';
  }
}

export function assertReadOnlyInternals(): void {
  const i = SPONSOR_MESH_INTERNALS;
  if (
    i.stage !== 'STAGE_0_READ_ONLY' ||
    i.liveExecutionEnabled ||
    i.retryEnabled ||
    i.backgroundEnabled ||
    i.realUsersAllowed ||
    i.billingEnabled ||
    i.chargesEnabled
  ) {
    throw new SponsorMeshIntegrityError('internal invariants violated');
  }
}

export function assertNodesValid(nodes: ReadonlyArray<SponsorNode>): void {
  const seen = new Set<string>();
  for (const n of nodes) {
    if (!n.id || !n.city || !n.category) {
      throw new SponsorMeshIntegrityError('node missing required identifiers');
    }
    if (seen.has(n.id)) {
      throw new SponsorMeshIntegrityError(`duplicate sponsor id: ${n.id}`);
    }
    seen.add(n.id);
    if (n.qualityIndex < 0 || n.qualityIndex > 1) {
      throw new SponsorMeshIntegrityError(`qualityIndex out of range: ${n.id}`);
    }
  }
}

export function assertPolicyValid(p: SponsorAllocationPolicy): void {
  if (p.fairnessFloor < 0 || p.fairnessFloor > 1) {
    throw new SponsorMeshIntegrityError('fairnessFloor out of range');
  }
  if (p.maxShareDominance <= 0 || p.maxShareDominance > 1) {
    throw new SponsorMeshIntegrityError('maxShareDominance out of range');
  }
  if (p.fairnessFloor > p.maxShareDominance) {
    throw new SponsorMeshIntegrityError('fairnessFloor must be <= maxShareDominance');
  }
  if (p.maxExposurePerSponsorPerSlot <= 0) {
    throw new SponsorMeshIntegrityError('maxExposurePerSponsorPerSlot must be > 0');
  }
}

export function assertExposuresValid(events: ReadonlyArray<SponsorExposureEvent>): void {
  for (const e of events) {
    if (!Number.isFinite(e.tick) || e.tick < 0) {
      throw new SponsorMeshIntegrityError('invalid tick');
    }
    if (e.weight < 0) {
      throw new SponsorMeshIntegrityError('negative exposure weight');
    }
  }
}

export function assertSnapshotIntegrity(snap: SponsorMeshSnapshot): void {
  assertReadOnlyInternals();
  assertNodesValid(snap.nodes);
  assertPolicyValid(snap.policy);
  assertExposuresValid(snap.exposures);
  if (!Object.isFrozen(snap)) {
    throw new SponsorMeshIntegrityError('snapshot not frozen');
  }
}
