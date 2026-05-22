/**
 * Final Certification Lineage — linhagem cumulativa terminal.
 */
import { SPONSOR_FINAL_CERTIFICATION_INTERNALS } from './sponsorFinalCertificationInternals';

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export interface FinalCertificationLineageEntry {
  readonly layer: string;
  readonly cumulativeSignature: string;
}

export function buildFinalCertificationLineage(): readonly FinalCertificationLineageEntry[] {
  const out: FinalCertificationLineageEntry[] = [];
  let acc = 'final-certification-1.9.50';
  for (const layer of SPONSOR_FINAL_CERTIFICATION_INTERNALS.consumes) {
    acc = djb2(acc + '|' + layer);
    out.push(Object.freeze({ layer, cumulativeSignature: acc }));
  }
  return Object.freeze(out);
}
