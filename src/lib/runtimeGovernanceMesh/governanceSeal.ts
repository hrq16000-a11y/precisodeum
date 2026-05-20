import type {
  GovernanceSeal,
  LayerSnapshot,
  RuntimeLayer,
  CrossLayerInvariant,
} from './meshTypes';

const REQUIRED_INVARIANTS: ReadonlyArray<{
  name: string;
  check: (s: LayerSnapshot) => boolean;
}> = [
  { name: 'liveExecutionDisabled', check: (s) => s.liveExecutionEnabled === false },
  { name: 'retryDisabled', check: (s) => s.retryEnabled === false },
  { name: 'backgroundDisabled', check: (s) => s.backgroundEnabled === false },
  { name: 'realUsersDisallowed', check: (s) => s.realUsersAllowed === false },
  { name: 'readOnlyStage', check: (s) => s.stage === 'STAGE_0_READ_ONLY' },
];

export function buildGovernanceSeal(
  layers: readonly LayerSnapshot[],
  options?: { previous?: GovernanceSeal },
): GovernanceSeal {
  const invariants: CrossLayerInvariant[] = REQUIRED_INVARIANTS.map((inv) => {
    const violators = layers.filter((l) => !inv.check(l)).map((l) => l.layer);
    return {
      name: inv.name,
      satisfied: violators.length === 0,
      layersChecked: layers.map((l) => l.layer),
      violators,
    };
  });

  const violatingLayersSet = new Set<RuntimeLayer>();
  invariants.forEach((i) => i.violators.forEach((v) => violatingLayersSet.add(v)));
  const violatingLayers = Array.from(violatingLayersSet);

  const allOk = invariants.every((i) => i.satisfied);
  const someOk = invariants.some((i) => i.satisfied);

  let strength: GovernanceSeal['strength'];
  if (allOk) strength = 'full';
  else if (violatingLayers.length === layers.length) strength = 'broken';
  else if (someOk && violatingLayers.length <= Math.ceil(layers.length / 2)) strength = 'partial';
  else strength = 'weak';

  const regression = options?.previous
    ? options.previous.intact && !allOk
    : false;

  return {
    id: `seal_${layers.length}_${invariants.filter((i) => !i.satisfied).length}`,
    strength,
    intact: allOk,
    invariants,
    violatingLayers,
    regression,
  };
}

export function verifySealIntegrity(seal: GovernanceSeal): boolean {
  return seal.intact && seal.strength === 'full' && !seal.regression;
}

export function classifySealStrength(seal: GovernanceSeal): GovernanceSeal['strength'] {
  return seal.strength;
}

export function detectSealWeakness(seal: GovernanceSeal): readonly string[] {
  return seal.invariants.filter((i) => !i.satisfied).map((i) => i.name);
}

export function detectInvariantBreak(seal: GovernanceSeal): readonly CrossLayerInvariant[] {
  return seal.invariants.filter((i) => !i.satisfied);
}

export function detectSealRegression(seal: GovernanceSeal): boolean {
  return seal.regression;
}
