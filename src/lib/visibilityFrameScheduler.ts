/**
 * visibilityFrameScheduler — estado único para agendamento de medições de
 * visibilidade (sticky CTA) a partir de scroll / resize / IntersectionObserver.
 *
 * Antes, cada origem manipulava a mesma variável `frame` solta no efeito, o que
 * tornava o cancelamento inconsistente (ex.: `resize` cancelando um frame de
 * `scroll` sem registrar a origem). Aqui centralizamos:
 *   - id do frame (`frameId`)
 *   - flags (`pending`, `disposed`)
 *   - origem do agendamento (`lastSource`)
 *
 * Em modo dev também contabilizamos quantos frames foram agendados, ignorados,
 * cancelados e — o mais importante para validar vazamentos — quantos chegaram a
 * executar DEPOIS do desmontar.
 */
export type VisibilityMeasureSource = 'init' | 'scroll' | 'resize' | 'observer';

export interface VisibilityFrameMetrics {
  scheduled: number;
  skipped: number;
  cancelled: number;
  executed: number;
  executedAfterDispose: number;
  bySource: Record<VisibilityMeasureSource, number>;
  lastSource: VisibilityMeasureSource | null;
}

export interface VisibilityFrameScheduler {
  /** Agenda uma medição no próximo frame (dedupe por frame). */
  schedule: (source?: VisibilityMeasureSource) => void;
  /** Cancela o frame pendente, se houver. Retorna true se algo foi cancelado. */
  cancel: () => boolean;
  /** Marca o scheduler como desmontado e cancela qualquer frame pendente. */
  dispose: () => void;
  /** true enquanto existir frame agendado ainda não executado. */
  isPending: () => boolean;
  lastSource: () => VisibilityMeasureSource | null;
  metrics: () => VisibilityFrameMetrics;
}

interface CreateOptions {
  /** Callback executado dentro do requestAnimationFrame. */
  measure: (source: VisibilityMeasureSource) => void;
  /** Habilita a coleta de métricas (default: import.meta.env.DEV). */
  debug?: boolean;
  /** Injeção para testes. */
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (handle: number) => void;
}

const emptyMetrics = (): VisibilityFrameMetrics => ({
  scheduled: 0,
  skipped: 0,
  cancelled: 0,
  executed: 0,
  executedAfterDispose: 0,
  bySource: { init: 0, scroll: 0, resize: 0, observer: 0 },
  lastSource: null,
});

export function createVisibilityFrameScheduler({
  measure,
  debug = Boolean(import.meta.env?.DEV),
  raf,
  caf,
}: CreateOptions): VisibilityFrameScheduler {
  const requestFrame = raf ?? ((cb: FrameRequestCallback) => requestAnimationFrame(cb));
  const cancelFrame = caf ?? ((handle: number) => cancelAnimationFrame(handle));

  const state = {
    frameId: null as number | null,
    disposed: false,
    lastSource: null as VisibilityMeasureSource | null,
  };
  const metrics = emptyMetrics();

  const cancel = () => {
    if (state.frameId === null) return false;
    cancelFrame(state.frameId);
    state.frameId = null;
    if (debug) metrics.cancelled += 1;
    return true;
  };

  return {
    schedule(source: VisibilityMeasureSource = 'init') {
      if (state.disposed) return;
      state.lastSource = source;
      if (debug) {
        metrics.lastSource = source;
        metrics.bySource[source] += 1;
      }
      if (state.frameId !== null) {
        if (debug) metrics.skipped += 1;
        return;
      }
      if (debug) metrics.scheduled += 1;
      state.frameId = requestFrame(() => {
        state.frameId = null;
        if (debug) {
          metrics.executed += 1;
          if (state.disposed) metrics.executedAfterDispose += 1;
        }
        if (state.disposed) return;
        measure(source);
      });
    },
    cancel,
    dispose() {
      cancel();
      state.disposed = true;
    },
    isPending: () => state.frameId !== null,
    lastSource: () => state.lastSource,
    metrics: () => ({ ...metrics, bySource: { ...metrics.bySource } }),
  };
}
