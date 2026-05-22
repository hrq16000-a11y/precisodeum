/**
 * Terminal Certification Topology — topologia canônica da certificação terminal.
 */
import { SPONSOR_FINAL_CERTIFICATION_INTERNALS } from './sponsorFinalCertificationInternals';

export interface TerminalCertificationNode {
  readonly layer: string;
  readonly certified: true;
  readonly terminal: boolean;
}

export function buildTerminalCertificationTopology(): readonly TerminalCertificationNode[] {
  const layers = SPONSOR_FINAL_CERTIFICATION_INTERNALS.consumes;
  return Object.freeze(
    layers.map((layer, i) =>
      Object.freeze({
        layer,
        certified: true as const,
        terminal: i === layers.length - 1,
      }),
    ),
  );
}
