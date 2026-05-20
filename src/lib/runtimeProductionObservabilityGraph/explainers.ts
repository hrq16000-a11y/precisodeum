import {
  type ObservabilityEnvelope,
  type ObservabilityExplainer,
  deepFreeze,
} from './observabilityTypes';

export function explainObservabilityEnvelope(
  envelope: ObservabilityEnvelope,
): ObservabilityExplainer {
  const bullets = [
    `stage=${envelope.stage}`,
    `nodes=${envelope.graph.nodes.length}`,
    `edges=${envelope.graph.edges.length}`,
    `aggregates=${envelope.aggregates.length}`,
    `stability=${envelope.stability.length}`,
    `signature=${envelope.signature}`,
  ];
  return deepFreeze({
    title: 'ObservabilityEnvelope',
    bullets,
  });
}
