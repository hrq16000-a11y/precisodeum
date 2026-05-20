import type {
  LayerSnapshot,
  MeshContainment,
  MeshContainmentMode,
  RuntimeLayer,
} from './meshTypes';

export function buildMeshContainment(layers: readonly LayerSnapshot[]): MeshContainment {
  const leakingLayers = layers
    .filter((l) => l.containment === 'leaking' || l.containment === 'collapsed')
    .map((l) => l.layer);
  const recursiveLayers = layers
    .filter((l) => l.topology === 'recursive' || l.topology === 'collapsed')
    .map((l) => l.layer);
  const escapeDetected = layers.some(
    (l) => l.liveExecutionEnabled || l.realUsersAllowed,
  );
  const envelopeStable = layers.every(
    (l) => l.drift === 'none' || l.drift === 'minor',
  );

  let mode: MeshContainmentMode;
  if (leakingLayers.length === 0 && recursiveLayers.length === 0 && !escapeDetected) {
    mode = 'sealed';
  } else if (recursiveLayers.length > 0 && layers.some((l) => l.containment === 'collapsed')) {
    mode = 'collapsed';
  } else if (recursiveLayers.length > 0) {
    mode = 'recursive';
  } else if (leakingLayers.length > 0 || escapeDetected) {
    mode = 'leaking';
  } else {
    mode = 'isolated';
  }

  return { mode, leakingLayers, recursiveLayers, escapeDetected, envelopeStable };
}

export function detectContainmentLeak(c: MeshContainment): boolean {
  return c.leakingLayers.length > 0 || c.escapeDetected;
}

export function detectRecursiveLeak(c: MeshContainment): boolean {
  return c.recursiveLayers.length > 0;
}

export function detectCrossLayerEscape(c: MeshContainment): readonly RuntimeLayer[] {
  return c.leakingLayers.filter((l) => c.recursiveLayers.includes(l));
}

export function detectEnvelopeInstability(c: MeshContainment): boolean {
  return !c.envelopeStable;
}

export function classifyContainment(c: MeshContainment): MeshContainmentMode {
  return c.mode;
}
