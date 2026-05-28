/**
 * buildPhaseActionGroups — helpers PUROS para callbacks UI-only repetidos
 * dentro do OnboardingV2Shell. Não move ownership de runtime: o shell
 * continua dono de `dispatch`, persistência e telemetria. Estes helpers
 * apenas evitam JSX denso quando o mesmo padrão de payload se repete em
 * fases distintas (DRY composicional).
 *
 * Cobertura inicial:
 *   • `recordExtrasBRegistrationSnapshot` — encapsula o dynamic import +
 *     `recordRegistrationSnapshotOnce(buildRegistrationSnapshotPayload(...))`
 *     duplicado em `phase4_extras_b` (skip + finish). O recorder é
 *     fire-and-forget (igual ao `void import(...)` original) e mantém a
 *     mesma semântica observável.
 *
 * PR 15 — Final Shell Density Pass (UI-only).
 */
import {
  buildRegistrationSnapshotPayload,
  type RegistrationSnapshotPayload,
} from './buildPhaseLayoutProps';

type ProfileLike = Record<string, any>;

/**
 * Dispara (fire-and-forget) o registro do snapshot final de cadastro do
 * `phase4_extras_b`. Mantém o mesmo padrão `void import(...)` que vivia
 * inline no shell — apenas remove a duplicação textual e isola o payload
 * builder em um helper puro.
 */
export const recordExtrasBRegistrationSnapshot = (
  profile: ProfileLike,
  hasFirstService: boolean,
  finishedVia: 'skip' | 'finish',
): void => {
  const payload: RegistrationSnapshotPayload = buildRegistrationSnapshotPayload(
    profile,
    hasFirstService,
    finishedVia,
  );
  void import('@/lib/registrationSnapshot').then(({ recordRegistrationSnapshotOnce }) =>
    recordRegistrationSnapshotOnce(payload),
  );
};

export default recordExtrasBRegistrationSnapshot;
