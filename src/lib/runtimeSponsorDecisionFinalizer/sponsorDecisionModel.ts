/**
 * Phase 1.9.15 — Sponsor Decision Finalizer · Decision Model
 * Types only. READ-ONLY / DETERMINISTIC / IMMUTABLE.
 */
import type {
  SponsorAllocationPolicy,
  SponsorAllocationResult,
  SponsorAttributionTrace,
  SponsorExposureEvent,
  SponsorFairnessLedger,
  SponsorGeoMeshNode,
  SponsorNode,
  SponsorQualityIndex,
  SponsorSaturationMap,
  SponsorSlot,
} from '@/lib/runtimeSponsorMonetizationMesh';

export type SponsorDecisionStage = 'STAGE_0_READ_ONLY';

export interface SponsorDecisionInternals {
  readonly stage: SponsorDecisionStage;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly billingEnabled: false;
  readonly chargesEnabled: false;
  readonly postDecisionMutationAllowed: false;
}

export interface NormalizedDecisionInput {
  readonly slotId: string;
  readonly sponsorId: string | null;
  readonly rankingScore: number;       // 0..1
  readonly fairnessWeight: number;     // 0..1
  readonly saturationPenalty: number;  // 0..1 (higher = more penalty)
  readonly geoBalanceFactor: number;   // 0..1
  readonly exposureDecayFactor: number; // 0..1
}

export interface SponsorDecisionEntry {
  readonly slotId: string;
  readonly sponsorId: string | null;
  readonly finalScore: number; // 0..1
  readonly priority: number;   // ordinal 0..N-1
  readonly inputs: NormalizedDecisionInput;
  readonly reason: 'allocated' | 'fairness_floor' | 'saturated' | 'no_candidates';
}

export interface SponsorDecisionContext {
  readonly nodes: ReadonlyArray<SponsorNode>;
  readonly slots: ReadonlyArray<SponsorSlot>;
  readonly exposures: ReadonlyArray<SponsorExposureEvent>;
  readonly quality: ReadonlyArray<SponsorQualityIndex>;
  readonly fairness: SponsorFairnessLedger;
  readonly saturation: SponsorSaturationMap;
  readonly geo: ReadonlyArray<SponsorGeoMeshNode>;
  readonly allocations: ReadonlyArray<SponsorAllocationResult>;
  readonly attribution: ReadonlyArray<SponsorAttributionTrace>;
  readonly policy: SponsorAllocationPolicy;
}

export interface SponsorDecisionSnapshot {
  readonly version: '1.9.15';
  readonly internals: SponsorDecisionInternals;
  readonly entries: ReadonlyArray<SponsorDecisionEntry>;
  readonly assignments: Readonly<Record<string, string | null>>; // slotId -> sponsorId
  readonly orderedSlots: ReadonlyArray<string>;
  readonly signature: string;
  readonly locked: true;
}

export const SPONSOR_DECISION_INTERNALS: SponsorDecisionInternals = Object.freeze({
  stage: 'STAGE_0_READ_ONLY',
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
  billingEnabled: false,
  chargesEnabled: false,
  postDecisionMutationAllowed: false,
});
