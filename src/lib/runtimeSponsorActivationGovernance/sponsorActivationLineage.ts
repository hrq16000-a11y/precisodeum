import { UPSTREAM_LAYERS, type SponsorUpstreamLayerId, djb2 } from './sponsorActivationInternals';

export interface SponsorActivationLineageEntry {
  readonly layer: SponsorUpstreamLayerId;
  readonly index: number;
  readonly cumulativeSignature: string;
}

export interface SponsorActivationLineage {
  readonly entries: ReadonlyArray<SponsorActivationLineageEntry>;
  readonly activationSignature: string;
}

export function computeActivationLineage(): SponsorActivationLineage {
  const entries: SponsorActivationLineageEntry[] = [];
  let acc = 'activation:genesis';
  UPSTREAM_LAYERS.forEach((layer, index) => {
    acc = djb2(`${acc}|${layer}|${index}`);
    entries.push(Object.freeze({ layer, index, cumulativeSignature: acc }));
  });
  return Object.freeze({
    entries: Object.freeze(entries),
    activationSignature: `sig:activation:${acc}`,
  });
}
