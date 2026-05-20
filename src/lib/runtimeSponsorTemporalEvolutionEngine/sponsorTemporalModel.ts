/**
 * Phase 1.9.17 — Sponsor Temporal Evolution Engine · Model.
 * READ-ONLY / DETERMINISTIC / IMMUTABLE.
 * Time is a pure integer dimension of input. NO Date.now, NO timers.
 */

export type SponsorTemporalStage = 'STAGE_0_READ_ONLY';

export interface SponsorTemporalInternals {
  readonly stage: SponsorTemporalStage;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
  readonly billingEnabled: false;
  readonly chargesEnabled: false;
  readonly schedulingEnabled: false;
  readonly realClockAllowed: false;
  readonly decisionalImpactAllowed: false;
  readonly campaignMutationAllowed: false;
}

export const SPONSOR_TEMPORAL_INTERNALS: SponsorTemporalInternals = Object.freeze({
  stage: 'STAGE_0_READ_ONLY',
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
  billingEnabled: false,
  chargesEnabled: false,
  schedulingEnabled: false,
  realClockAllowed: false,
  decisionalImpactAllowed: false,
  campaignMutationAllowed: false,
});

/** Pure logical tick. Non-negative integer. */
export interface TemporalTick {
  readonly index: number;
}

export interface CampaignTimeSlice {
  readonly campaignId: string;
  readonly tickIndex: number;
  /** Projected intensity at this tick (0..1). */
  readonly projectedIntensity: number;
  /** Projected derived weight at this tick (0..1). */
  readonly projectedWeight: number;
  /** Lifecycle as virtually evolved (does NOT mutate the campaign). */
  readonly projectedLifecycle: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';
}

export interface ExposureDecayVector {
  readonly campaignId: string;
  /** Per-tick geometric decay factor (0..1]. tick=0 → 1.0 (no decay). */
  readonly decayPerTick: number;
  /** Cumulative multiplier applied at tickIndex (decayPerTick^tickIndex). */
  readonly cumulativeMultiplier: number;
  /** Decayed intensity = original * cumulativeMultiplier. */
  readonly decayedIntensity: number;
}

export interface PacingWindow {
  readonly campaignId: string;
  readonly tickIndex: number;
  /** Window length in ticks (>= 1). */
  readonly windowSize: number;
  /** Position within window [0..windowSize-1]. */
  readonly windowPosition: number;
  /** Pacing factor (0..1) — triangular budget across window. */
  readonly pacingFactor: number;
  /** Budget share allocated to this tick (0..1). */
  readonly allocatedShare: number;
}

export interface EvolutionFrame {
  readonly campaignId: string;
  readonly tickIndex: number;
  readonly timeSlice: CampaignTimeSlice;
  readonly decay: ExposureDecayVector;
  readonly pacing: PacingWindow;
  /** Composite projected exposure ∈ [0..1] = intensity*decay*pacing. */
  readonly projectedExposure: number;
  readonly frameSignature: string;
}

export interface TemporalSnapshot {
  readonly version: '1.9.17';
  readonly internals: SponsorTemporalInternals;
  readonly tick: TemporalTick;
  readonly frames: ReadonlyArray<EvolutionFrame>;
  readonly campaignSignature: string;
  readonly decisionSignature: string | null;
  readonly signature: string;
  readonly locked: true;
}

export interface TemporalProjectionOptions {
  /** Default decay-per-tick if not specified per campaign. Default 0.95. */
  readonly defaultDecayPerTick?: number;
  /** Default pacing window size. Default 7. */
  readonly defaultPacingWindow?: number;
  /** Per-campaign overrides. */
  readonly decayOverrides?: Readonly<Record<string, number>>;
  readonly pacingOverrides?: Readonly<Record<string, number>>;
}

export class SponsorTemporalIntegrityError extends Error {
  constructor(message: string) {
    super(`[sponsor-temporal] ${message}`);
    this.name = 'SponsorTemporalIntegrityError';
  }
}
