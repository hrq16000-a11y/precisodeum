import {
  type CausalityChain,
  deepFreeze,
  sigOf,
  cloneSorted,
} from './observabilityTypes';
import { type MetricLineage } from './metricLineage';

export interface MetricCausality {
  readonly chains: ReadonlyArray<CausalityChain>;
  readonly signature: string;
}

export function buildMetricCausality(lineage: MetricLineage): MetricCausality {
  const adj = new Map<string, string[]>();
  for (const e of lineage.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const chains: CausalityChain[] = [];
  const visit = (root: string, node: string, path: string[], seen: Set<string>): void => {
    if (seen.has(node)) {
      const p = path.slice();
      chains.push({ root, path: p, signature: sigOf({ root, path: p }) });
      return;
    }
    const next = adj.get(node);
    if (!next || next.length === 0) {
      const p = path.slice();
      chains.push({ root, path: p, signature: sigOf({ root, path: p }) });
      return;
    }
    const ns = new Set(seen);
    ns.add(node);
    for (const c of cloneSorted(next, (a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      visit(root, c, path.concat(c), ns);
    }
  };
  for (const r of lineage.roots) visit(r, r, [r], new Set());
  const sorted = cloneSorted(chains, (a, b) => (a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0));
  const out = { chains: sorted, signature: sigOf(sorted) };
  return deepFreeze(out);
}
