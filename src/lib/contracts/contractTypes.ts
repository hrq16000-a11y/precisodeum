/**
 * Fase 1.7.5 — Architectural Contract Types (PURE).
 *
 * Tipos declarativos de contratos arquiteturais entre flows, boundaries,
 * ownership, telemetria, atomicidade, mirror e rollback. Sem persistência,
 * sem hooks, sem Supabase.
 */

import type { ContactOwner } from '@/lib/contactOwnership';
import type {
  BoundaryId,
  FlowId,
  Readiness,
} from '@/lib/operations/operationRegistry';
import type { WriteClassification } from '@/lib/drift/writeClassification';

export type MutationPolicyId =
  | 'READ_ONLY'
  | 'GUARDED_MUTATION'
  | 'MIRROR_MUTATION'
  | 'CANONICAL_MUTATION'
  | 'LEGACY_MUTATION'
  | 'ATOMIC_CANDIDATE';

export type GuaranteeLevel = 'NONE' | 'PARTIAL' | 'STRONG' | 'VERIFIED';

export interface BaseContract {
  /** Garantias declaradas pelo contrato (strings curtas, sem PII). */
  guarantees: string[];
  /** Dependências estruturais (outros contratos/registries). */
  dependencies: string[];
  /** Premissas tomadas pelo contrato. */
  assumptions: string[];
  /** Eventos de auditoria obrigatórios. */
  requiredObservability: string[];
  /** Classifications aceitas para este contrato. */
  allowedClassifications: WriteClassification[];
  /** Readiness mínima exigida. */
  requiredReadiness: Readiness | 'ANY';
  /** Política de mutação aplicada. */
  mutationPolicy: MutationPolicyId;
  /** Expectativa de rollback. */
  rollbackExpectation: 'none' | 'client_side' | 'atomic_required';
}

export interface FlowContract extends BaseContract {
  kind: 'flow';
  flow: FlowId;
  boundary: BoundaryId;
  ownership: ContactOwner | 'mixed';
}

export interface BoundaryContract extends BaseContract {
  kind: 'boundary';
  boundary: BoundaryId;
  /** Flows que ancoram nesta boundary. */
  flows: FlowId[];
  hasTracker: boolean;
}

export interface OwnershipContract extends BaseContract {
  kind: 'ownership';
  owner: ContactOwner | 'mixed';
  /** Flows que assumem este ownership. */
  flows: FlowId[];
}

export interface ExecutionContract extends BaseContract {
  kind: 'execution';
  /** dry-run / live (1.6.9). */
  mode: 'dry-run' | 'live';
  flows: FlowId[];
}

export interface TelemetryContract extends BaseContract {
  kind: 'telemetry';
  /** Categorias da telemetria 1.7.4 que ESTE flow deve emitir. */
  emits: string[];
  flow: FlowId;
}

export interface AtomicityContract extends BaseContract {
  kind: 'atomicity';
  flow: FlowId;
  supportsAtomic: boolean;
  isMultiStep: boolean;
  /** Indica que está aguardando RPC atômica. */
  requiresAtomicMigration: boolean;
}

export interface MirrorContract extends BaseContract {
  kind: 'mirror';
  flow: FlowId;
  hasMirror: boolean;
  mirrorRequired: boolean;
}

export interface RollbackContract extends BaseContract {
  kind: 'rollback';
  flow: FlowId;
  /** Pode reverter client-side de forma observável. */
  supportsRollback: boolean;
}

export type ArchitecturalContract =
  | FlowContract
  | BoundaryContract
  | OwnershipContract
  | ExecutionContract
  | TelemetryContract
  | AtomicityContract
  | MirrorContract
  | RollbackContract;

export interface ContractCoverageReport {
  ok: boolean;
  totalFlows: number;
  flowsWithContract: number;
  boundariesWithContract: number;
  flowsMissingContract: FlowId[];
  boundariesMissingContract: BoundaryId[];
}
