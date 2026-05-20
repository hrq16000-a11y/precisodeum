/**
 * Phase 1.9.14 — Runtime Sponsor Monetization Mesh
 * Pure structural types. READ-ONLY / DETERMINISTIC / REVERSIBLE.
 * No billing, no payment, no financial gateway.
 */

export type SponsorMeshStage = 'STAGE_0_READ_ONLY';

export interface SponsorMeshInternals {
  readonly stage: SponsorMeshStage;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly billingEnabled: false;
  readonly chargesEnabled: false;
}

export interface SponsorNode {
  readonly id: string;
  readonly city: string;
  readonly category: string;
  readonly tier: 'basic' | 'pro' | 'premium';
  readonly qualityIndex: number; // 0..1
  readonly active: boolean;
}

export interface SponsorEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly relation: 'co_city' | 'co_category' | 'co_audience';
  readonly weight: number; // 0..1
}

export interface SponsorExposureEvent {
  readonly sponsorId: string;
  readonly slotId: string;
  readonly city: string;
  readonly category: string;
  readonly tick: number; // logical clock (no Date.now)
  readonly weight: number;
}

export interface SponsorSlot {
  readonly id: string;
  readonly city: string;
  readonly category: string;
  readonly capacity: number;
  readonly priority: number; // 0..1
}

export interface SponsorAllocationPolicy {
  readonly maxExposurePerSponsorPerSlot: number;
  readonly maxShareDominance: number; // 0..1
  readonly fairnessFloor: number;     // 0..1 minimum share guaranteed
  readonly geoBalanceWeight: number;  // 0..1
}

export interface SponsorFairnessLedgerEntry {
  readonly sponsorId: string;
  readonly city: string;
  readonly category: string;
  readonly grantedShare: number;
  readonly fairnessScore: number; // 0..1
}

export interface SponsorFairnessLedger {
  readonly entries: ReadonlyArray<SponsorFairnessLedgerEntry>;
  readonly aggregateFairness: number; // 0..1
}

export interface SponsorSaturationMapEntry {
  readonly sponsorId: string;
  readonly city: string;
  readonly category: string;
  readonly saturation: number; // 0..1
  readonly capped: boolean;
}

export interface SponsorSaturationMap {
  readonly entries: ReadonlyArray<SponsorSaturationMapEntry>;
}

export interface SponsorAttributionTrace {
  readonly sponsorId: string;
  readonly slotId: string;
  readonly lineage: ReadonlyArray<string>; // ordered upstream node ids
  readonly signature: string;
}

export interface SponsorQualityIndex {
  readonly sponsorId: string;
  readonly score: number; // 0..1
  readonly components: Readonly<Record<string, number>>;
}

export interface SponsorGeoMeshNode {
  readonly city: string;
  readonly density: number;       // 0..1 demand density
  readonly representation: number; // 0..1 sponsor presence
  readonly balanceDelta: number;   // representation - density
}

export interface SponsorAllocationResult {
  readonly slotId: string;
  readonly sponsorId: string | null;
  readonly score: number;
  readonly reason: 'allocated' | 'fairness_floor' | 'saturated' | 'no_candidates';
}

export interface SponsorMeshSnapshot {
  readonly nodes: ReadonlyArray<SponsorNode>;
  readonly edges: ReadonlyArray<SponsorEdge>;
  readonly slots: ReadonlyArray<SponsorSlot>;
  readonly exposures: ReadonlyArray<SponsorExposureEvent>;
  readonly policy: SponsorAllocationPolicy;
  readonly signature: string;
  readonly internals: SponsorMeshInternals;
}
