/**
 * Fase 1.7.9 — Compatibility matrix (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import { buildFlowPromotionState } from '@/lib/atomicPromotion/promotionMatrix';
import type {
  RpcCompatibilityLevel,
  RpcCompatibilityRow,
} from './rpcContractTypes';
import { getCatalogEntryByFlow, RPC_CATALOG } from './rpcCatalog';

function classifyCompatibility(
  flow: FlowId,
  promotionStage: ReturnType<typeof buildFlowPromotionState>,
): RpcCompatibilityLevel {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return 'NONE';
  if (reg.boundary === 'inline_call_site') return 'WEAK';
  const blast = calculateBlastRadius(flow);
  if (blast?.level === 'CRITICAL') return 'PARTIAL';
  if (!getRollbackStrategy(flow)) return 'WEAK';
  if (!promotionStage) return 'PARTIAL';
  const max = promotionStage.maxAllowedStage;
  if (max === 'STAGE_4_FULL_ATOMIC') return 'FULL';
  if (max === 'STAGE_3_PARTIAL_ATOMIC') return 'STRONG';
  if (max === 'STAGE_2_SOFT_PILOT') return 'PARTIAL';
  return 'WEAK';
}

export function buildRpcCompatibilityMatrix(): RpcCompatibilityRow[] {
  const rows: RpcCompatibilityRow[] = [];
  for (const entry of RPC_CATALOG) {
    const reg = OPERATION_REGISTRY.find((r) => r.flow === entry.flow);
    if (!reg) continue;
    const promo = buildFlowPromotionState(entry.flow);
    const rollback = getRollbackStrategy(entry.flow);
    const blast = calculateBlastRadius(entry.flow);
    rows.push({
      rpc: entry.rpc,
      flow: entry.flow,
      boundaries: [reg.boundary],
      builders: entry.requiredBuilders,
      promotionStage: promo?.maxAllowedStage ?? 'STAGE_0_READ_ONLY',
      rollback: rollback?.strategy ?? 'noop_rollback',
      driftSensitivity: blast?.level ?? 'MEDIUM',
      liveGateOpen: false as const,
      compatibility: classifyCompatibility(entry.flow, promo),
    });
  }
  return rows;
}

export function summarizeRpcCompatibility(): string {
  const m = buildRpcCompatibilityMatrix();
  const byLevel = m.reduce<Record<string, number>>((acc, r) => {
    acc[r.compatibility] = (acc[r.compatibility] ?? 0) + 1;
    return acc;
  }, {});
  return `[RPC-COMPAT] rpcs=${m.length} ${Object.entries(byLevel)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')}`;
}

const COMPAT_ORDER: RpcCompatibilityLevel[] = [
  'FULL',
  'STRONG',
  'PARTIAL',
  'WEAK',
  'NONE',
];

export function rankRpcReadiness(): string[] {
  const m = buildRpcCompatibilityMatrix();
  return m
    .slice()
    .sort(
      (a, b) =>
        COMPAT_ORDER.indexOf(a.compatibility) -
        COMPAT_ORDER.indexOf(b.compatibility),
    )
    .map((r) => r.rpc);
}

export function getCompatibilityForFlow(
  flow: FlowId,
): RpcCompatibilityRow | undefined {
  const entry = getCatalogEntryByFlow(flow);
  if (!entry) return undefined;
  return buildRpcCompatibilityMatrix().find((r) => r.rpc === entry.rpc);
}
