/**
 * Fase 1.7.0 — Live execution gate.
 *
 * Centraliza TODA autorização para a `executeOperation` rodar em modo `live`.
 * Por contrato, o default absoluto é `dry-run`. Nenhuma camada do app pode
 * ligar live mode sem passar por este gate.
 *
 * Ativação exige TRÊS condições simultâneas (defense-in-depth):
 *   1. Build flag explícita: `import.meta.env.VITE_OPERATIONS_LIVE === 'true'`
 *   2. Runtime opt-in:       `window.__OPERATIONS_LIVE_OPT_IN__ === true`
 *   3. Override programático opcional via `setLiveExecutionOverride(true)`
 *      (usado apenas pelos testes; nunca em produção).
 *
 * Qualquer chamada a `assertLiveExecutionAllowed` quando o gate está fechado
 * emite `live_execution_blocked` (sem PII) e retorna `false`.
 */

import { logAuditAction } from '@/hooks/useAuditLog';

export type ExecutionMode = 'dry-run' | 'live';

const ENV_FLAG_KEY = 'VITE_OPERATIONS_LIVE';
const RUNTIME_FLAG_KEY = '__OPERATIONS_LIVE_OPT_IN__';

let programmaticOverride: boolean | null = null;

function readBuildFlag(): boolean {
  try {
    // import.meta.env é congelado em build-time
    const v = (import.meta as any)?.env?.[ENV_FLAG_KEY];
    return v === 'true' || v === true;
  } catch {
    return false;
  }
}

function readRuntimeFlag(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return (window as any)[RUNTIME_FLAG_KEY] === true;
  } catch {
    return false;
  }
}

/** Test-only escape hatch. Não exposto fora deste módulo em runtime. */
export function setLiveExecutionOverride(v: boolean | null): void {
  programmaticOverride = v;
}

export function isLiveExecutionEnabled(): boolean {
  if (programmaticOverride !== null) return programmaticOverride === true;
  return readBuildFlag() && readRuntimeFlag();
}

export function getExecutionMode(): ExecutionMode {
  return isLiveExecutionEnabled() ? 'live' : 'dry-run';
}

export interface ExecutionModeExplanation {
  mode: ExecutionMode;
  buildFlag: boolean;
  runtimeFlag: boolean;
  programmaticOverride: boolean | null;
  reason: string;
}

export function explainExecutionMode(): ExecutionModeExplanation {
  const build = readBuildFlag();
  const runtime = readRuntimeFlag();
  const enabled = isLiveExecutionEnabled();
  const reason = enabled
    ? programmaticOverride === true
      ? 'programmatic_override'
      : 'build_and_runtime_flags_set'
    : programmaticOverride === false
    ? 'programmatic_override_blocked'
    : !build && !runtime
    ? 'no_flags_set'
    : !build
    ? 'missing_build_flag'
    : 'missing_runtime_flag';
  return {
    mode: enabled ? 'live' : 'dry-run',
    buildFlag: build,
    runtimeFlag: runtime,
    programmaticOverride,
    reason,
  };
}

export interface AssertLiveOptions {
  source: string;
  flow?: string;
  boundary?: string;
}

/**
 * Returns true if live execution is permitted; otherwise emits
 * `live_execution_blocked` and returns false. NEVER throws.
 */
export async function assertLiveExecutionAllowed(
  opts: AssertLiveOptions,
): Promise<boolean> {
  if (isLiveExecutionEnabled()) return true;
  const explanation = explainExecutionMode();
  try {
    await logAuditAction({
      action: 'live_execution_blocked' as any,
      resource_type: 'live_execution_gate',
      details: {
        source: opts.source,
        flow: opts.flow ?? null,
        boundary: opts.boundary ?? null,
        execution_mode: explanation.mode,
        reason: explanation.reason,
        build_flag: explanation.buildFlag,
        runtime_flag: explanation.runtimeFlag,
      },
    });
  } catch {
    /* fail-soft */
  }
  return false;
}
