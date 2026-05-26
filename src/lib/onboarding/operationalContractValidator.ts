/**
 * Cross-Engine Contract Validator
 * ─────────────────────────────────────────────────────────────────────────────
 * Valida coerência estrutural entre adapters, evidence, correlation, governance,
 * runtime, mirror e memory. Pure, deterministic, read-only.
 */

import type { RuntimeSignal } from './runtimeSignalAdapter';

export type ContractFindingId =
  | 'contract_mismatch'
  | 'missing_runtime_mapping'
  | 'incompatible_signal_shape'
  | 'inconsistent_severity_mapping'
  | 'orphan_engine_contract';

export interface ContractFinding {
  id: ContractFindingId;
  layer: string;
  severity: 'low' | 'medium' | 'high';
  note: string;
}

export interface ContractValidationReport {
  findings: ContractFinding[];
  validatedLayers: string[];
  contractIntegrity: number; // 0..100
}

const REQUIRED_SIGNAL_KEYS = [
  'id',
  'kind',
  'source',
  'at',
  'session_id',
  'user_id',
  'phase',
  'severity',
  'category',
  'meta',
  'partial',
] as const;

const ALLOWED_SEVERITY = new Set(['info', 'low', 'medium', 'high', 'critical']);

const LAYERS = ['adapter', 'evidence', 'correlation', 'governance', 'runtime', 'mirror', 'memory'];

export function validateOperationalContracts(
  signals: ReadonlyArray<RuntimeSignal>,
): ContractValidationReport {
  const findings: ContractFinding[] = [];

  // incompatible_signal_shape — chaves faltando
  for (const s of signals.slice(0, 50)) {
    const missing = REQUIRED_SIGNAL_KEYS.filter((k) => !(k in (s as unknown as Record<string, unknown>)));
    if (missing.length > 0) {
      findings.push({
        id: 'incompatible_signal_shape',
        layer: 'adapter',
        severity: 'high',
        note: `signal ${s?.id ?? '?'} missing keys: ${missing.join(',')}`,
      });
    }
    if (s && typeof s === 'object' && !ALLOWED_SEVERITY.has(s.severity as string)) {
      findings.push({
        id: 'inconsistent_severity_mapping',
        layer: 'adapter',
        severity: 'medium',
        note: `unexpected severity "${s.severity}"`,
      });
    }
  }

  // missing_runtime_mapping — nenhum sinal possui phase
  const withPhase = signals.filter((s) => !!s.phase).length;
  if (signals.length > 5 && withPhase === 0) {
    findings.push({
      id: 'missing_runtime_mapping',
      layer: 'runtime',
      severity: 'high',
      note: 'no signals carry a phase mapping',
    });
  }

  // orphan_engine_contract — kind não reconhecido
  const KNOWN_KINDS = new Set(['event', 'incident', 'release', 'experiment', 'flag', 'behavioral', 'regression', 'memory', 'hardening', 'evidence']);
  const unknownKinds = new Set<string>();
  for (const s of signals) {
    if (!KNOWN_KINDS.has(s.kind as string)) unknownKinds.add(s.kind as string);
  }
  for (const k of unknownKinds) {
    findings.push({
      id: 'orphan_engine_contract',
      layer: 'adapter',
      severity: 'medium',
      note: `unknown kind "${k}" with no consumer`,
    });
  }

  // contract_mismatch — at negativo
  const negativeAt = signals.filter((s) => typeof s.at === 'number' && s.at < 0).length;
  if (negativeAt > 0) {
    findings.push({
      id: 'contract_mismatch',
      layer: 'adapter',
      severity: 'medium',
      note: `${negativeAt} signals with negative timestamp`,
    });
  }

  const integrity = Math.max(0, 100 - findings.length * 10);

  return { findings, validatedLayers: [...LAYERS], contractIntegrity: integrity };
}
