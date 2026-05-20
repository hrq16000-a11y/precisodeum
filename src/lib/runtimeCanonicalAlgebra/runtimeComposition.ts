import type { RuntimeComposition, RuntimeNode, RuntimeState } from './algebraTypes';

export function composeRuntimeStates(
  nodes: readonly RuntimeNode[],
): RuntimeComposition {
  const composed = nodes.map((n) => n.id);
  const conflicts: { a: string; b: string; reason: string }[] = [];

  // Conflicts: two nodes in same layer with different stage.
  const byLayer = new Map<string, RuntimeNode[]>();
  for (const n of nodes) {
    const arr = byLayer.get(n.layer) ?? [];
    arr.push(n);
    byLayer.set(n.layer, arr);
  }
  for (const [, arr] of byLayer) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i].state.stage !== arr[j].state.stage) {
          conflicts.push({
            a: arr[i].id,
            b: arr[j].id,
            reason: 'stage_conflict',
          });
        }
        if (
          arr[i].state.liveExecutionEnabled !== arr[j].state.liveExecutionEnabled ||
          arr[i].state.retryEnabled !== arr[j].state.retryEnabled ||
          arr[i].state.backgroundEnabled !== arr[j].state.backgroundEnabled
        ) {
          conflicts.push({
            a: arr[i].id,
            b: arr[j].id,
            reason: 'invariant_conflict',
          });
        }
      }
    }
  }

  const explosion = nodes.length > 256;
  const recursive = nodes.some((n) => n.recursive);
  let classification: RuntimeComposition['classification'];
  if (recursive) classification = 'recursive';
  else if (conflicts.length > 0) classification = 'conflicting';
  else if (explosion) classification = 'overcomposed';
  else if (nodes.length === 0) classification = 'unstable';
  else classification = 'safe';

  return Object.freeze<RuntimeComposition>({
    composed: Object.freeze(composed),
    conflicts: Object.freeze(conflicts.map((c) => Object.freeze(c))),
    explosion,
    classification,
  });
}

export function decomposeRuntimeState(
  node: RuntimeNode,
): readonly RuntimeState[] {
  return Object.freeze([node.state]);
}

export function classifyComposition(c: RuntimeComposition): RuntimeComposition['classification'] {
  return c.classification;
}

export function detectCompositionConflict(c: RuntimeComposition): boolean {
  return c.conflicts.length > 0;
}

export function detectStateExplosion(c: RuntimeComposition): boolean {
  return c.explosion;
}

export function reduceComposition(c: RuntimeComposition): RuntimeComposition {
  // Deterministic: deduplicate conflicts.
  const seen = new Set<string>();
  const unique: RuntimeComposition['conflicts'][number][] = [];
  for (const conf of c.conflicts) {
    const key = `${conf.a}|${conf.b}|${conf.reason}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(conf);
    }
  }
  return Object.freeze({ ...c, conflicts: Object.freeze(unique) });
}
