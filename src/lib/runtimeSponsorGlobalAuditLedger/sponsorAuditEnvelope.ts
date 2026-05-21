/**
 * Phase 1.9.22 — Audit envelope & ledger entry models.
 * Loosely-typed inputs: any upstream snapshot exposing a `signature` is accepted.
 * This keeps the ledger structurally decoupled from layer internals.
 */

export type SponsorAuditLayerId =
  | 'mesh'        // 1.9.14
  | 'decision'    // 1.9.15
  | 'campaign'    // 1.9.16
  | 'temporal'    // 1.9.17
  | 'contract'    // 1.9.18
  | 'api'         // 1.9.19
  | 'surface'     // 1.9.20
  | 'consistency';// 1.9.21

export interface SponsorSignedArtifact {
  readonly signature: string;
  readonly [k: string]: unknown;
}

export interface SponsorAuditLedgerEntry {
  readonly index: number;
  readonly layer: SponsorAuditLayerId;
  readonly artifactKind: string;
  readonly upstreamSignature: string;
  readonly lineageRefs: ReadonlyArray<string>;
  readonly entrySignature: string;
}

export interface SponsorTraceCorrelationVector {
  readonly chainSignature: string;
  readonly orderedLayers: ReadonlyArray<SponsorAuditLayerId>;
  readonly orderedSignatures: ReadonlyArray<string>;
  readonly correlationMap: Readonly<Record<SponsorAuditLayerId, string | null>>;
}

export interface SponsorGlobalLineageNode {
  readonly id: string;       // `${layer}:${upstreamSignature}`
  readonly layer: SponsorAuditLayerId;
  readonly signature: string;
}

export interface SponsorGlobalLineageGraph {
  readonly nodes: ReadonlyArray<SponsorGlobalLineageNode>;
  readonly edges: ReadonlyArray<readonly [string, string]>;
  readonly graphSignature: string;
}

export interface SponsorReplayFrame {
  readonly frameIndex: number;
  readonly layer: SponsorAuditLayerId;
  readonly upstreamSignature: string;
  readonly frameSignature: string;
}

export interface SponsorDeterministicReplaySnapshot {
  readonly frames: ReadonlyArray<SponsorReplayFrame>;
  readonly replaySignature: string;
}

export interface SponsorAuditEnvelope {
  readonly envelopeVersion: 'v1';
  readonly ledger: ReadonlyArray<SponsorAuditLedgerEntry>;
  readonly correlation: SponsorTraceCorrelationVector;
  readonly lineage: SponsorGlobalLineageGraph;
  readonly replay: SponsorDeterministicReplaySnapshot;
  readonly envelopeSignature: string;
  readonly locked: true;
}

/** Strict layer ordering used everywhere in the ledger. */
export const SPONSOR_AUDIT_LAYER_ORDER: ReadonlyArray<SponsorAuditLayerId> = Object.freeze([
  'mesh',
  'decision',
  'campaign',
  'temporal',
  'contract',
  'api',
  'surface',
  'consistency',
]);
