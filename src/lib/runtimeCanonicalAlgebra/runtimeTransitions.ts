import type {
  RuntimeEdge,
  RuntimeNode,
  RuntimeTransition,
  RuntimeTransitionMode,
} from './algebraTypes';

export function classifyTransition(e: RuntimeEdge): RuntimeTransitionMode {
  if (e.recursive) return 'recursive';
  if (e.weight <= 0) return 'impossible';
  if (e.weight >= 0.95) return 'deterministic';
  if (e.weight >= 0.7) return 'equivalent';
  if (e.weight >= 0.4) return 'degraded';
  return 'unstable';
}

export function buildRuntimeTransitions(
  nodes: readonly RuntimeNode[],
  edges: readonly RuntimeEdge[],
  options?: { previous?: readonly RuntimeTransition[] },
): readonly RuntimeTransition[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const prev = new Map<string, RuntimeTransition>();
  if (options?.previous) {
    for (const t of options.previous) prev.set(`${t.from}>${t.to}`, t);
  }
  return Object.freeze(
    edges.map((e) => {
      const mode = classifyTransition(e);
      const possible = nodeIds.has(e.from) && nodeIds.has(e.to) && mode !== 'impossible';
      const deterministic = mode === 'deterministic';
      const previous = prev.get(`${e.from}>${e.to}`);
      const regression = previous
        ? previous.deterministic && !deterministic
        : false;
      return Object.freeze<RuntimeTransition>({
        from: e.from,
        to: e.to,
        mode,
        possible,
        deterministic,
        regression,
      });
    }),
  );
}

export function detectTransitionInstability(
  transitions: readonly RuntimeTransition[],
): readonly RuntimeTransition[] {
  return transitions.filter((t) => t.mode === 'unstable' || t.mode === 'degraded');
}

export function detectTransitionRegression(
  transitions: readonly RuntimeTransition[],
): readonly RuntimeTransition[] {
  return transitions.filter((t) => t.regression);
}

export function detectImpossibleTransition(
  transitions: readonly RuntimeTransition[],
): readonly RuntimeTransition[] {
  return transitions.filter((t) => !t.possible || t.mode === 'impossible');
}

export function aggregateTransitionHealth(
  transitions: readonly RuntimeTransition[],
): {
  readonly total: number;
  readonly deterministic: number;
  readonly impossible: number;
  readonly unstable: number;
  readonly score: number; // 0..1
} {
  const total = transitions.length;
  const deterministic = transitions.filter((t) => t.deterministic).length;
  const impossible = transitions.filter((t) => !t.possible).length;
  const unstable = detectTransitionInstability(transitions).length;
  const score =
    total === 0
      ? 1
      : Math.max(
          0,
          Math.min(1, (deterministic - impossible * 2 - unstable) / Math.max(1, total)),
        );
  return Object.freeze({ total, deterministic, impossible, unstable, score });
}
