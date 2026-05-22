/**
 * Final Certification Envelope — envelope terminal bit-stable.
 */
import { SPONSOR_FINAL_CERTIFICATION_INTERNALS } from './sponsorFinalCertificationInternals';
import { buildFinalCertificationSnapshot, type FinalCertificationSnapshot } from './sponsorFinalCertificationSnapshot';
import { buildFinalCertificationLineage, type FinalCertificationLineageEntry } from './sponsorFinalCertificationLineage';
import { buildFinalCertificationProofMatrix, type FinalCertificationProof } from './sponsorFinalCertificationProofs';

function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export interface FinalCertificationEnvelope {
  readonly phase: string;
  readonly plane: string;
  readonly isFoundationTerminalPhase: true;
  readonly snapshot: FinalCertificationSnapshot;
  readonly lineage: readonly FinalCertificationLineageEntry[];
  readonly proofs: readonly FinalCertificationProof[];
  readonly signature: string;
}

export function buildFinalCertificationEnvelope(): FinalCertificationEnvelope {
  const body = {
    phase: SPONSOR_FINAL_CERTIFICATION_INTERNALS.phase,
    plane: SPONSOR_FINAL_CERTIFICATION_INTERNALS.plane,
    isFoundationTerminalPhase: SPONSOR_FINAL_CERTIFICATION_INTERNALS.isFoundationTerminalPhase as true,
    snapshot: buildFinalCertificationSnapshot(),
    lineage: buildFinalCertificationLineage(),
    proofs: buildFinalCertificationProofMatrix(),
  };
  return Object.freeze({ ...body, signature: djb2(canonical(body)) });
}
