import type {
  LayerSnapshot,
  MeshConsensus,
  MeshConsensusLevel,
  MeshSeverity,
  RuntimeLayer,
} from './meshTypes';

const DIMENSIONS = [
  'stage',
  'readiness',
  'certification',
  'containment',
  'topology',
  'drift',
] as const;

type Dimension = (typeof DIMENSIONS)[number];

function valueFor(layer: LayerSnapshot, dim: Dimension): string {
  switch (dim) {
    case 'stage':
      return layer.stage;
    case 'readiness':
      return layer.readiness;
    case 'certification':
      return layer.certification;
    case 'containment':
      return layer.containment;
    case 'topology':
      return layer.topology;
    case 'drift':
      return layer.drift;
  }
}

export function buildConsensusMatrix(
  layers: readonly LayerSnapshot[],
): Readonly<Record<Dimension, Readonly<Record<string, readonly RuntimeLayer[]>>>> {
  const matrix = {} as Record<Dimension, Record<string, RuntimeLayer[]>>;
  for (const dim of DIMENSIONS) {
    matrix[dim] = {};
    for (const layer of layers) {
      const v = valueFor(layer, dim);
      (matrix[dim][v] ||= []).push(layer.layer);
    }
  }
  return matrix as any;
}

export function detectConsensusGap(
  matrix: ReturnType<typeof buildConsensusMatrix>,
): readonly { dimension: string; layers: readonly RuntimeLayer[] }[] {
  const gaps: { dimension: string; layers: RuntimeLayer[] }[] = [];
  for (const dim of DIMENSIONS) {
    const buckets = matrix[dim];
    const keys = Object.keys(buckets);
    if (keys.length <= 1) continue;
    // Minority buckets are gaps
    const sorted = keys.sort((a, b) => buckets[b].length - buckets[a].length);
    for (let i = 1; i < sorted.length; i++) {
      gaps.push({ dimension: `${dim}:${sorted[i]}`, layers: [...buckets[sorted[i]]] });
    }
  }
  return gaps;
}

export function detectCrossLayerConflict(
  layers: readonly LayerSnapshot[],
): readonly { dimension: string; layers: readonly RuntimeLayer[] }[] {
  const conflicts: { dimension: string; layers: RuntimeLayer[] }[] = [];
  const liveOn = layers.filter((l) => l.liveExecutionEnabled).map((l) => l.layer);
  if (liveOn.length > 0) conflicts.push({ dimension: 'liveExecution', layers: liveOn });
  const retryOn = layers.filter((l) => l.retryEnabled).map((l) => l.layer);
  if (retryOn.length > 0) conflicts.push({ dimension: 'retry', layers: retryOn });
  const bgOn = layers.filter((l) => l.backgroundEnabled).map((l) => l.layer);
  if (bgOn.length > 0) conflicts.push({ dimension: 'background', layers: bgOn });
  return conflicts;
}

export function classifyConsensus(agreementScore: number): MeshConsensusLevel {
  if (agreementScore >= 0.999) return 'unanimous';
  if (agreementScore >= 0.75) return 'majority';
  if (agreementScore >= 0.4) return 'split';
  return 'collapsed';
}

export function rankConsensusRisk(level: MeshConsensusLevel, gapCount: number): MeshSeverity {
  if (level === 'collapsed') return 'critical';
  if (level === 'split') return 'high';
  if (level === 'majority' && gapCount > 3) return 'medium';
  if (level === 'majority') return 'low';
  return 'info';
}

export function aggregateConsensusHealth(layers: readonly LayerSnapshot[]): MeshConsensus {
  if (layers.length === 0) {
    return {
      level: 'collapsed',
      agreementScore: 0,
      disagreements: [],
      gap: true,
      risk: 'critical',
    };
  }
  const matrix = buildConsensusMatrix(layers);
  const gaps = detectConsensusGap(matrix);
  const conflicts = detectCrossLayerConflict(layers);
  const disagreements = [...gaps, ...conflicts];

  // Agreement: per dimension, dominant bucket fraction averaged.
  let sum = 0;
  for (const dim of DIMENSIONS) {
    const buckets = matrix[dim];
    const counts = Object.values(buckets).map((arr) => arr.length);
    const max = Math.max(0, ...counts);
    sum += max / layers.length;
  }
  let agreementScore = sum / DIMENSIONS.length;
  if (conflicts.length > 0) agreementScore = Math.min(agreementScore, 0.3);

  const level = classifyConsensus(agreementScore);
  const risk = rankConsensusRisk(level, disagreements.length);

  return {
    level,
    agreementScore,
    disagreements,
    gap: disagreements.length > 0,
    risk,
  };
}
