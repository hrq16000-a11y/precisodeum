/**
 * SponsorFinalProductionReadinessCertificationPlane — plane terminal.
 * 100% read-only, fail-closed, determinístico. Encerra a fundação core.
 */
import { SPONSOR_FINAL_CERTIFICATION_INTERNALS } from './sponsorFinalCertificationInternals';
import { buildFinalCertificationEnvelope, type FinalCertificationEnvelope } from './sponsorFinalCertificationEnvelope';
import { assertTerminalReadiness, type TerminalReadinessAssertion } from './sponsorTerminalReadinessEvaluator';

export interface FinalProductionReadinessCertification {
  readonly envelope: FinalCertificationEnvelope;
  readonly terminalReadiness: TerminalReadinessAssertion;
  readonly productionAuthorized: false;
  readonly rolloutAuthorized: false;
  readonly billingAuthorized: false;
  readonly monetizationAuthorized: false;
  readonly mode: 'DETERMINISTIC_TERMINAL_CERTIFICATION_ONLY';
  readonly foundationSealed: true;
}

export function certifyFinalProductionReadiness(): FinalProductionReadinessCertification {
  if (SPONSOR_FINAL_CERTIFICATION_INTERNALS.realProductionAllowed) {
    throw new Error('REAL_PRODUCTION_FORBIDDEN');
  }
  if (SPONSOR_FINAL_CERTIFICATION_INTERNALS.realRolloutAllowed) {
    throw new Error('REAL_ROLLOUT_FORBIDDEN');
  }
  const terminal = assertTerminalReadiness();
  return Object.freeze({
    envelope: buildFinalCertificationEnvelope(),
    terminalReadiness: terminal,
    productionAuthorized: false,
    rolloutAuthorized: false,
    billingAuthorized: false,
    monetizationAuthorized: false,
    mode: SPONSOR_FINAL_CERTIFICATION_INTERNALS.certificationMode,
    foundationSealed: true,
  });
}
