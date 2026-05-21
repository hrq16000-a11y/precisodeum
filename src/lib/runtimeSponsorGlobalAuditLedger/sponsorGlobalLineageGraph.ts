/**
 * Phase 1.9.22 — Global lineage graph (DAG over layer signatures).
 */
import {
  type SponsorAuditLayerId,
  type SponsorGlobalLineageGraph,
  type SponsorGlobalLineageNode,
  type SponsorTraceCorrelationVector,
} from './sponsorAuditEnvelope';
import { deepFreeze, signObject } from './sponsorAuditInternals';

function nodeId(layer: SponsorAuditLayerId, signature: string): string {
  return `${layer}:${signature}`;
}

export function computeGlobalLineageGraph(
  correlation: SponsorTraceCorrelationVector,
): SponsorGlobalLineageGraph {
  const nodes: SponsorGlobalLineageNode[] = [];
  const edges: Array<readonly [string, string]> = [];

  for (let i = 0; i < correlation.orderedLayers.length; i++) {
    const layer = correlation.orderedLayers[i];
    const signature = correlation.orderedSignatures[i];
    nodes.push(
      Object.freeze({
        id: nodeId(layer, signature),
        layer,
        signature,
      }),
    );
    if (i > 0) {
      const prev = nodeId(
        correlation.orderedLayers[i - 1],
        correlation.orderedSignatures[i - 1],
      );
      edges.push(Object.freeze([prev, nodeId(layer, signature)] as const));
    }
  }

  const graphSignature = signObject({
    nodes: nodes.map((n) => n.id),
    edges,
  });

  return deepFreeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    graphSignature,
  });
}
