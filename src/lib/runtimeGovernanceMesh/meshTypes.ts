/**
 * Phase 1.8.9 — Runtime Immutable Governance Mesh types.
 *
 * 100% read-only / deterministic / side-effect free. No runtime imports.
 */

export const RUNTIME_LAYERS = [
  'recorder',
  'history',
  'replay',
  'causality',
  'stability',
  'integrity',
  'isolation',
  'enforcement',
  'immutable-core',
  'certification',
  'governance',
  'promotion',
  'pilot',
] as const;

export type RuntimeLayer = (typeof RUNTIME_LAYERS)[number];

export type MeshSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type MeshConsensusLevel = 'unanimous' | 'majority' | 'split' | 'collapsed';
export type MeshContainmentMode = 'sealed' | 'isolated' | 'leaking' | 'recursive' | 'collapsed';
export type MeshTopologyState = 'stable' | 'overlapping' | 'recursive' | 'circular' | 'collapsed';
export type MeshIsolationMode = 'fully_isolated' | 'contained' | 'shared' | 'leaking' | 'collapsed';
export type MeshCertificationLevel = 'full' | 'partial' | 'conditional' | 'blocked';

export type MeshViolationCode =
  | 'MESH_CONSENSUS_COLLAPSED'
  | 'MESH_ISOLATION_LEAK'
  | 'MESH_TOPOLOGY_RECURSION'
  | 'MESH_CONTAINMENT_ESCAPE'
  | 'MESH_CERTIFICATION_INVALID'
  | 'MESH_READONLY_INVARIANT_BROKEN'
  | 'MESH_SEAL_COMPROMISED';

export interface LayerSnapshot {
  readonly layer: RuntimeLayer;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly readiness: 'ready' | 'partial' | 'blocked';
  readonly certification: 'full' | 'partial' | 'conditional' | 'blocked';
  readonly containment: 'sealed' | 'contained' | 'leaking' | 'collapsed';
  readonly topology: 'stable' | 'overlapping' | 'recursive' | 'collapsed';
  readonly drift: 'none' | 'minor' | 'major' | 'critical';
  readonly invariants: Readonly<Record<string, boolean>>;
}

export interface CrossLayerInvariant {
  readonly name: string;
  readonly satisfied: boolean;
  readonly layersChecked: readonly RuntimeLayer[];
  readonly violators: readonly RuntimeLayer[];
}

export interface GovernanceSeal {
  readonly id: string;
  readonly strength: 'full' | 'partial' | 'weak' | 'broken';
  readonly intact: boolean;
  readonly invariants: readonly CrossLayerInvariant[];
  readonly violatingLayers: readonly RuntimeLayer[];
  readonly regression: boolean;
}

export interface MeshConsensus {
  readonly level: MeshConsensusLevel;
  readonly agreementScore: number; // 0..1
  readonly disagreements: readonly {
    readonly dimension: string;
    readonly layers: readonly RuntimeLayer[];
  }[];
  readonly gap: boolean;
  readonly risk: MeshSeverity;
}

export interface MeshContainment {
  readonly mode: MeshContainmentMode;
  readonly leakingLayers: readonly RuntimeLayer[];
  readonly recursiveLayers: readonly RuntimeLayer[];
  readonly escapeDetected: boolean;
  readonly envelopeStable: boolean;
}

export interface MeshTopology {
  readonly state: MeshTopologyState;
  readonly overlaps: readonly (readonly [RuntimeLayer, RuntimeLayer])[];
  readonly cycles: readonly (readonly RuntimeLayer[])[];
  readonly recursive: boolean;
  readonly collapsed: boolean;
}

export interface MeshIsolationState {
  readonly mode: MeshIsolationMode;
  readonly leakingLayers: readonly RuntimeLayer[];
  readonly score: number; // 0..1
}

export interface MeshCertification {
  readonly level: MeshCertificationLevel;
  readonly governanceOk: boolean;
  readonly isolationOk: boolean;
  readonly containmentOk: boolean;
  readonly consensusOk: boolean;
  readonly immutableOk: boolean;
  readonly confidence: number; // 0..1
  readonly reasons: readonly string[];
}

export interface MeshViolation {
  readonly code: MeshViolationCode;
  readonly severity: MeshSeverity;
  readonly layers: readonly RuntimeLayer[];
  readonly message: string;
}

export interface MeshRisk {
  readonly id: string;
  readonly severity: MeshSeverity;
  readonly description: string;
  readonly layers: readonly RuntimeLayer[];
}

export interface MeshHealth {
  readonly score: number; // 0..100
  readonly status: 'healthy' | 'degraded' | 'unstable' | 'collapsed';
  readonly violationCount: number;
  readonly criticalViolations: number;
}

export interface RuntimeGovernanceMesh {
  readonly generatedAt: string;
  readonly layers: readonly LayerSnapshot[];
  readonly seal: GovernanceSeal;
  readonly consensus: MeshConsensus;
  readonly containment: MeshContainment;
  readonly topology: MeshTopology;
  readonly isolation: MeshIsolationState;
  readonly certification: MeshCertification;
  readonly violations: readonly MeshViolation[];
  readonly risks: readonly MeshRisk[];
  readonly health: MeshHealth;
  readonly readOnly: true;
}

export interface MeshAggregation {
  readonly mesh: RuntimeGovernanceMesh;
  readonly integrityScore: number; // 0..100
  readonly confidence: number; // 0..1
  readonly summary: string;
}
