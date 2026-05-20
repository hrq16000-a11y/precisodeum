/**
 * Fase 1.8.0 — Pure trace recorder (READ-ONLY).
 *
 * Funções puras, sem I/O, sem storage, sem retries. Estados são
 * estruturas imutáveis devolvidas a cada chamada. O recorder NÃO
 * dispara writes, NÃO altera fluxo, NÃO persiste em lugar algum.
 */

import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import type {
  RuntimeTraceClassification,
  RuntimeTraceSeverity,
  RuntimeWriteBoundary,
  RuntimeWriteOrdering,
  RuntimeWriteStep,
  RuntimeWriteTrace,
  TraceConsistencyState,
  TraceExecutionMode,
  TraceFailureClass,
  TraceOrderingClass,
} from './recorderTypes';

const SEV_RANK: Record<RuntimeTraceSeverity, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function expectedSteps(flow: FlowId): string[] {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  return reg ? [...reg.steps] : [];
}

let traceCounter = 0;
function nextTraceId(flow: FlowId): string {
  traceCounter = (traceCounter + 1) % 1_000_000;
  return `trace:${flow}:${traceCounter}`;
}

export function createRuntimeTrace(
  flow: FlowId,
  source: RuntimeWriteBoundary,
  mode: TraceExecutionMode = 'observe_only',
): RuntimeWriteTrace {
  const expected = expectedSteps(flow);
  return {
    id: nextTraceId(flow),
    flow,
    source,
    mode,
    steps: [],
    ordering: {
      expectedOrder: expected,
      actualOrder: [],
      class: 'expected',
      violations: [],
    },
    consistency: 'unknown',
    classification: 'SAFE',
    severity: 'NONE',
    failureSummary: 'none',
    mirrorDependent: false,
    orphanRisk: false,
    liveExecution: false,
    retry: false,
    background: false,
    persisted: false,
    realUserMutation: false,
  };
}

export function appendTraceStep(
  trace: RuntimeWriteTrace,
  step: Omit<RuntimeWriteStep, 'order'>,
): RuntimeWriteTrace {
  const order = trace.steps.length;
  const enriched: RuntimeWriteStep = { ...step, order };
  const nextSteps = [...trace.steps, enriched];
  const actualOrder = nextSteps.map((s) => s.step);
  return {
    ...trace,
    steps: nextSteps,
    ordering: {
      ...trace.ordering,
      actualOrder,
    },
  };
}

export function detectTraceOrderingViolation(
  trace: RuntimeWriteTrace,
): RuntimeWriteOrdering {
  const expected = trace.ordering.expectedOrder;
  const actual = trace.ordering.actualOrder;
  const violations: TraceOrderingClass[] = [];

  const expectedIndex = (s: string) => expected.indexOf(s);
  for (let i = 1; i < actual.length; i++) {
    const prev = expectedIndex(actual[i - 1]);
    const cur = expectedIndex(actual[i]);
    if (prev >= 0 && cur >= 0 && cur < prev) {
      violations.push('out_of_order');
      break;
    }
  }

  const hasFinalize = actual.includes('finalize');
  const hasMirror = trace.steps.some((s) => s.mirror);
  if (hasFinalize && hasMirror) {
    const finIdx = actual.indexOf('finalize');
    const firstMirror = trace.steps.find((s) => s.mirror)?.order ?? -1;
    if (firstMirror >= 0 && finIdx >= 0 && finIdx < firstMirror) {
      violations.push('finalize_before_mirror');
    }
  }

  const ownerIdx = trace.steps.findIndex((s) => !s.mirror && s.status === 'ok');
  const mirrorIdx = trace.steps.findIndex((s) => s.mirror);
  if (mirrorIdx >= 0 && ownerIdx >= 0 && mirrorIdx < ownerIdx) {
    violations.push('mirror_before_owner');
  }

  const progressIdx = trace.steps.findIndex((s) => s.step === 'progress' || s.step === 'progress_sync');
  const finIdx = actual.indexOf('finalize');
  if (progressIdx >= 0 && finIdx >= 0 && progressIdx < finIdx) {
    violations.push('progress_before_finalize');
  }

  for (const s of trace.steps) {
    for (const dep of s.dependsOn) {
      const depStep = trace.steps.find((x) => x.step === dep);
      if (!depStep || depStep.order > s.order || depStep.status !== 'ok') {
        violations.push('unsafe_dependency');
        break;
      }
    }
    if (violations.includes('unsafe_dependency')) break;
  }

  const cls: TraceOrderingClass = violations.length === 0 ? 'expected' : violations[0];
  return {
    expectedOrder: expected,
    actualOrder: actual,
    class: cls,
    violations,
  };
}

export function detectTraceMirrorDependency(trace: RuntimeWriteTrace): boolean {
  const mirrors = trace.steps.filter((s) => s.mirror);
  if (mirrors.length === 0) return false;
  const ownerOk = trace.steps.some((s) => !s.mirror && s.status === 'ok');
  // mirror executou e proprietário falhou/ausente => dependência inversa
  return mirrors.some((m) => m.status === 'ok') && !ownerOk;
}

export function classifyTraceConsistency(
  trace: RuntimeWriteTrace,
): TraceConsistencyState {
  if (trace.steps.length === 0) return 'unknown';
  const failed = trace.steps.filter((s) => s.status === 'failed');
  const ok = trace.steps.filter((s) => s.status === 'ok');
  const aborted = trace.steps.filter((s) => s.status === 'aborted');
  if (failed.length === 0 && aborted.length === 0 && ok.length === trace.steps.length) {
    return 'consistent';
  }
  if (detectTraceMirrorDependency(trace)) return 'orphaned';
  if (failed.length > 0 && ok.length === 0) return 'inconsistent';
  if (failed.length > 0 || aborted.length > 0) return 'partial';
  return 'unknown';
}

function summarizeFailureClass(trace: RuntimeWriteTrace): TraceFailureClass {
  let worst: TraceFailureClass = 'none';
  const order: TraceFailureClass[] = [
    'none',
    'transient',
    'validation',
    'authorization',
    'dependency',
    'ordering',
    'mirror_dependency',
    'orphan',
    'critical',
  ];
  const rank = (c: TraceFailureClass) => order.indexOf(c);
  for (const s of trace.steps) {
    if (s.failure && rank(s.failure.class) > rank(worst)) worst = s.failure.class;
  }
  return worst;
}

export function calculateTraceSeverity(
  trace: RuntimeWriteTrace,
): RuntimeTraceSeverity {
  let worst: RuntimeTraceSeverity = 'NONE';
  for (const s of trace.steps) {
    if (s.failure && SEV_RANK[s.failure.severity] > SEV_RANK[worst]) {
      worst = s.failure.severity;
    }
  }
  if (detectTraceMirrorDependency(trace) && SEV_RANK['HIGH'] > SEV_RANK[worst]) {
    worst = 'HIGH';
  }
  return worst;
}

function classifyTrace(trace: RuntimeWriteTrace): RuntimeTraceClassification {
  const consistency = classifyTraceConsistency(trace);
  const severity = calculateTraceSeverity(trace);
  const mirror = detectTraceMirrorDependency(trace);
  if (severity === 'CRITICAL') return 'CRITICAL';
  if (consistency === 'orphaned') return 'ORPHAN_RISK';
  if (mirror) return 'MIRROR_DEPENDENT';
  if (consistency === 'inconsistent') return 'DIVERGENT';
  if (consistency === 'partial') return 'PARTIAL';
  const reg = OPERATION_REGISTRY.find((r) => r.flow === trace.flow);
  if (reg && !reg.supportsAtomic) return 'NON_ATOMIC';
  if (reg && reg.requiresFinalize && !trace.steps.some((s) => s.step === 'finalize' && s.status === 'ok')) {
    return 'EVENTUAL';
  }
  return 'SAFE';
}

export function finalizeRuntimeTrace(
  trace: RuntimeWriteTrace,
): RuntimeWriteTrace {
  const ordering = detectTraceOrderingViolation(trace);
  const consistency = classifyTraceConsistency(trace);
  const severity = calculateTraceSeverity(trace);
  const mirrorDependent = detectTraceMirrorDependency(trace);
  const finalized: RuntimeWriteTrace = {
    ...trace,
    ordering,
    consistency,
    severity,
    failureSummary: summarizeFailureClass(trace),
    mirrorDependent,
    orphanRisk: consistency === 'orphaned',
    classification: 'SAFE',
  };
  return {
    ...finalized,
    classification: classifyTrace(finalized),
  };
}
