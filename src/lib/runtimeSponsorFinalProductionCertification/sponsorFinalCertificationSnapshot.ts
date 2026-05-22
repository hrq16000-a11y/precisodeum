/**
 * Final Certification Snapshot — snapshot determinístico terminal.
 */
import { certifyProductionReadiness } from './sponsorProductionReadinessRuntime';
import { resolveOperationalAdmissibility } from './sponsorOperationalAdmissibilityResolver';
import { convergeEcosystemReadiness } from './sponsorReadinessConvergenceEngine';
import { buildReadinessConvergenceGraph } from './sponsorReadinessConvergenceGraph';
import { buildOperationalAdmissibilityTopology } from './sponsorOperationalAdmissibilityTopology';
import { buildTerminalCertificationTopology } from './sponsorTerminalCertificationTopology';
import { buildReadinessRegistry } from './sponsorReadinessRegistry';
import { buildOperationalCertificationRegistry } from './sponsorOperationalCertificationRegistry';
import { buildRolloutAdmissibilityRegistry } from './sponsorRolloutAdmissibilityRegistry';

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

export interface FinalCertificationSnapshot {
  readonly readiness: ReturnType<typeof certifyProductionReadiness>;
  readonly admissibility: ReturnType<typeof resolveOperationalAdmissibility>;
  readonly convergence: ReturnType<typeof convergeEcosystemReadiness>;
  readonly convergenceGraph: ReturnType<typeof buildReadinessConvergenceGraph>;
  readonly admissibilityTopology: ReturnType<typeof buildOperationalAdmissibilityTopology>;
  readonly certificationTopology: ReturnType<typeof buildTerminalCertificationTopology>;
  readonly readinessRegistry: ReturnType<typeof buildReadinessRegistry>;
  readonly operationalRegistry: ReturnType<typeof buildOperationalCertificationRegistry>;
  readonly rolloutAdmissibilityRegistry: ReturnType<typeof buildRolloutAdmissibilityRegistry>;
  readonly signature: string;
}

export function buildFinalCertificationSnapshot(): FinalCertificationSnapshot {
  const body = {
    readiness: certifyProductionReadiness(),
    admissibility: resolveOperationalAdmissibility(),
    convergence: convergeEcosystemReadiness(),
    convergenceGraph: buildReadinessConvergenceGraph(),
    admissibilityTopology: buildOperationalAdmissibilityTopology(),
    certificationTopology: buildTerminalCertificationTopology(),
    readinessRegistry: buildReadinessRegistry(),
    operationalRegistry: buildOperationalCertificationRegistry(),
    rolloutAdmissibilityRegistry: buildRolloutAdmissibilityRegistry(),
  };
  return Object.freeze({ ...body, signature: djb2(canonical(body)) });
}
