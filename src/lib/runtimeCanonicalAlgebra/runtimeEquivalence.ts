import type {
  RuntimeEquivalence,
  RuntimeEquivalenceClass,
  RuntimeNode,
} from './algebraTypes';

function signature(n: RuntimeNode): string {
  return JSON.stringify({
    layer: n.layer,
    stage: n.state.stage,
    cls: n.state.classification,
    attrs: n.state.attributes,
    live: n.state.liveExecutionEnabled,
    retry: n.state.retryEnabled,
    bg: n.state.backgroundEnabled,
  });
}

export function detectEquivalentStates(
  nodes: readonly RuntimeNode[],
): readonly { readonly a: string; readonly b: string }[] {
  const out: { a: string; b: string }[] = [];
  const sigs = nodes.map(signature);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (sigs[i] === sigs[j]) out.push({ a: nodes[i].id, b: nodes[j].id });
    }
  }
  return Object.freeze(out.map((p) => Object.freeze(p)));
}

export function detectEquivalentGraphs(
  a: readonly RuntimeNode[],
  b: readonly RuntimeNode[],
): boolean {
  if (a.length !== b.length) return false;
  const sa = a.map(signature).sort();
  const sb = b.map(signature).sort();
  return sa.every((s, i) => s === sb[i]);
}

export function classifyEquivalence(
  nodes: readonly RuntimeNode[],
  members: readonly string[],
): RuntimeEquivalenceClass {
  if (members.length < 2) return 'invalid';
  const subset = nodes.filter((n) => members.includes(n.id));
  if (subset.length !== members.length) return 'invalid';
  const sigs = subset.map(signature);
  if (sigs.every((s) => s === sigs[0])) return 'strict';
  const stages = new Set(subset.map((s) => s.state.stage));
  const layers = new Set(subset.map((s) => s.layer));
  if (stages.size === 1 && layers.size === 1) return 'structural';
  if (subset.every((s) => s.state.classification === subset[0].state.classification))
    return 'behavioral';
  return 'partial';
}

export function buildEquivalenceClasses(
  nodes: readonly RuntimeNode[],
): RuntimeEquivalence {
  const byKey = new Map<string, string[]>();
  for (const n of nodes) {
    const k = signature(n);
    const arr = byKey.get(k) ?? [];
    arr.push(n.id);
    byKey.set(k, arr);
  }
  const classes = Array.from(byKey.entries())
    .filter(([, m]) => m.length >= 2)
    .map(([k, m], idx) => {
      const kind = classifyEquivalence(nodes, m);
      return Object.freeze({
        id: `eq_${idx}_${k.length}`,
        members: Object.freeze([...m].sort()) as readonly string[],
        kind,
      });
    });

  // False equivalences: same id different sig → impossible by construction; flag
  // any nodes that share id but appear twice (defensive).
  const idCounts = new Map<string, number>();
  for (const n of nodes) idCounts.set(n.id, (idCounts.get(n.id) ?? 0) + 1);
  const falseEquivalences = Array.from(idCounts.entries())
    .filter(([, c]) => c > 1)
    .map(([id]) => Object.freeze({ a: id, b: id }));

  return Object.freeze<RuntimeEquivalence>({
    classes: Object.freeze(classes),
    falseEquivalences: Object.freeze(falseEquivalences),
  });
}

export function reduceEquivalentStructures(
  nodes: readonly RuntimeNode[],
): readonly RuntimeNode[] {
  const seen = new Set<string>();
  const out: RuntimeNode[] = [];
  for (const n of nodes) {
    const k = signature(n);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return Object.freeze(out);
}

export function detectFalseEquivalence(eq: RuntimeEquivalence): boolean {
  return eq.falseEquivalences.length > 0;
}
