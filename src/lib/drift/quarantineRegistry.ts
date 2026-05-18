/**
 * Fase 1.7.3 — Quarantine registry (READ-ONLY).
 *
 * Catálogo formal de write paths legacy/unsafe tolerados por compatibilidade.
 * NÃO bloqueia execução real. Apenas detecta e classifica para auditoria
 * estrutural e regression guard.
 *
 * Inclui:
 *  - LEGACY_WRITE_PATHS   → arquivos/flows tolerados explicitamente
 *  - UNSAFE_PATTERNS      → padrões de write proibidos em novos arquivos
 *  - QUARANTINED_WRITES   → união enriquecida com metadata
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type QuarantineCategory =
  | 'legacy_admin_approve_reject'
  | 'direct_update_outside_boundary'
  | 'write_outside_operation_registry'
  | 'dual_write_without_ownership'
  | 'onboarding_finalize_bypass';

export type QuarantineRisk = 'low' | 'medium' | 'high' | 'critical';

export interface QuarantinedWrite {
  id: string;
  category: QuarantineCategory;
  file?: string;
  flow?: FlowId;
  reason: string;
  risk: QuarantineRisk;
  /** Marca explícita: ainda tolerado em produção até a migração atômica. */
  allowedUntilAtomicMigration: boolean;
}

/**
 * Lista oficial de paths legacy tolerados. Ampliar exige PR explícito + atualização
 * dos testes de regressão (`legacy-write-isolation.test.ts`).
 */
export const LEGACY_WRITE_PATHS: readonly QuarantinedWrite[] = [
  {
    id: 'admin_page_legacy_approve_reject',
    category: 'legacy_admin_approve_reject',
    file: 'src/pages/AdminPage.tsx',
    reason: 'fluxo admin legado de approve/reject anterior à boundary adminWriteBoundary',
    risk: 'medium',
    allowedUntilAtomicMigration: true,
  },
] as const;

/** Padrões estruturais sempre considerados unsafe em arquivos novos. */
export const UNSAFE_PATTERNS: readonly {
  id: string;
  category: QuarantineCategory;
  pattern: string;
  risk: QuarantineRisk;
  reason: string;
}[] = [
  {
    id: 'direct_update_outside_boundary',
    category: 'direct_update_outside_boundary',
    pattern: 'supabase.from(...).update(...) fora de boundary canônica',
    risk: 'high',
    reason: 'writes diretos quebram observabilidade e ownership',
  },
  {
    id: 'write_outside_operation_registry',
    category: 'write_outside_operation_registry',
    pattern: 'flow multi-step sem registro em OPERATION_REGISTRY',
    risk: 'high',
    reason: 'sem readiness/ownership/tracker não é possível auditar',
  },
  {
    id: 'dual_write_without_ownership',
    category: 'dual_write_without_ownership',
    pattern: 'profiles+providers no mesmo flow sem ContactOwner resolvido',
    risk: 'critical',
    reason: 'dual-write sem ownership produz drift de contato/avatar/cidade',
  },
  {
    id: 'onboarding_finalize_bypass',
    category: 'onboarding_finalize_bypass',
    pattern: 'write direto em profiles.onboarding_completed / onboarding_step',
    risk: 'critical',
    reason: 'finalize precisa passar por finalize_onboarding_atomic',
  },
] as const;

/** Union enriquecido. */
export const QUARANTINED_WRITES: readonly QuarantinedWrite[] = [
  ...LEGACY_WRITE_PATHS,
] as const;

/** Verifica se um arquivo está na quarentena. */
export function isQuarantinedFile(file: string): QuarantinedWrite | null {
  return QUARANTINED_WRITES.find((q) => q.file === file) ?? null;
}

/** Verifica se um flow está na quarentena. */
export function isQuarantinedFlow(flow: FlowId): QuarantinedWrite | null {
  return QUARANTINED_WRITES.find((q) => q.flow === flow) ?? null;
}

/** Verdadeiro se o write está quarentenado (legacy tolerado) por flow ou arquivo. */
export function isQuarantinedWrite(input: { file?: string; flow?: FlowId }): boolean {
  if (input.file && isQuarantinedFile(input.file)) return true;
  if (input.flow && isQuarantinedFlow(input.flow)) return true;
  return false;
}

/**
 * READ-ONLY. NÃO lança em runtime. Retorna a razão de bloqueio caso o write
 * não esteja autorizado. Caller decide o que fazer (geralmente: telemetria).
 */
export function assertWriteAllowed(input: {
  file?: string;
  flow?: FlowId;
  classification: 'SAFE' | 'GUARDED' | 'LEGACY' | 'UNSAFE' | 'UNKNOWN';
}): { allowed: boolean; reason: string } {
  if (input.classification === 'SAFE' || input.classification === 'GUARDED') {
    return { allowed: true, reason: 'within_canonical_boundary' };
  }
  if (input.classification === 'LEGACY') {
    if (isQuarantinedWrite({ file: input.file, flow: input.flow })) {
      return { allowed: true, reason: 'legacy_quarantined' };
    }
    return { allowed: false, reason: 'legacy_not_quarantined' };
  }
  if (input.classification === 'UNSAFE') {
    return { allowed: false, reason: 'unsafe_write_path' };
  }
  return { allowed: false, reason: 'unknown_classification' };
}

/**
 * Compara um conjunto atual de "hits unsafe" (de detectUnsafeWrites) contra
 * a quarentena oficial e retorna apenas as EXPANSÕES — paths unsafe novos
 * fora da allow-list.
 */
export interface UnsafeExpansion {
  file: string;
  line: number;
  table: string | null;
  reason: string;
}

export function detectUnsafeWriteExpansion(
  hits: ReadonlyArray<{
    file: string;
    line: number;
    table: string | null;
    severity: 'SAFE' | 'LEGACY' | 'UNSAFE' | 'UNKNOWN';
    reason: string;
  }>,
): UnsafeExpansion[] {
  const out: UnsafeExpansion[] = [];
  for (const h of hits) {
    if (h.severity !== 'UNSAFE') continue;
    if (isQuarantinedFile(h.file)) continue;
    out.push({ file: h.file, line: h.line, table: h.table, reason: h.reason });
  }
  return out;
}

export function explainQuarantineReason(q: QuarantinedWrite): string {
  const target = q.flow ?? q.file ?? q.id;
  return `[QUARANTINE/${q.risk}] ${q.category} :: ${target} — ${q.reason}`;
}
