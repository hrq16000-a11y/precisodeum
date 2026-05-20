import {
  type ObservabilityEnvelope,
  type MetricSample,
  OBS_STAGE,
  OBS_INTERNALS,
  deepFreeze,
  sigOf,
} from './observabilityTypes';
import { normalizeMetrics } from './metricNormalization';
import { aggregateMetrics } from './metricAggregation';
import { buildProductionTelemetry } from './productionTelemetry';
import { buildTelemetryTopology } from './telemetryTopology';
import { computeStabilitySignals } from './stabilitySignals';

export function buildObservabilityEnvelope(
  samples: ReadonlyArray<MetricSample>,
  series: ReadonlyArray<{ id: string; values: ReadonlyArray<number> }>,
): ObservabilityEnvelope {
  const normalized = normalizeMetrics(samples);
  const telemetry = buildProductionTelemetry({ samples: normalized });
  const graph = buildTelemetryTopology(telemetry);
  const aggregates = aggregateMetrics(normalized);
  const stability = computeStabilitySignals(series);
  const out: ObservabilityEnvelope = {
    stage: OBS_STAGE,
    internals: OBS_INTERNALS,
    graph,
    aggregates,
    stability,
    signature: sigOf({
      g: graph.signature,
      a: aggregates.map((x) => x.signature),
      s: stability.map((x) => x.signature),
    }),
  };
  return deepFreeze(out);
}
