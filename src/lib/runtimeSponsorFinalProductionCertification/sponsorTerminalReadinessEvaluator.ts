/**
 * Terminal Readiness Evaluator — avalia readiness terminal fail-closed.
 */
import { certifyProductionReadiness } from './sponsorProductionReadinessRuntime';
import { resolveOperationalAdmissibility } from './sponsorOperationalAdmissibilityResolver';

export interface TerminalReadinessAssertion {
  readonly terminalReadiness: true;
  readonly allDimensionsReady: true;
  readonly allDimensionsAdmissible: true;
  readonly realActivationAuthorized: false;
}

export function assertTerminalReadiness(): TerminalReadinessAssertion {
  const r = certifyProductionReadiness();
  const a = resolveOperationalAdmissibility();
  const allReady = r.dimensions.every((d) => d.ready);
  const allAdm = a.every((d) => d.admissible);
  if (!allReady) throw new Error('TERMINAL_READINESS_NOT_ACHIEVED');
  if (!allAdm) throw new Error('TERMINAL_ADMISSIBILITY_NOT_ACHIEVED');
  if (r.productionAuthorized) throw new Error('REAL_PRODUCTION_FORBIDDEN');
  return Object.freeze({
    terminalReadiness: true,
    allDimensionsReady: true,
    allDimensionsAdmissible: true,
    realActivationAuthorized: false,
  });
}
