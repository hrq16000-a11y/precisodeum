/**
 * DonePhase — wrapper terminal da fase `done`.
 *
 * PR 12 (UI Composition Finalization). NÃO carrega submit, finalize ou
 * lifecycle ownership — esses permanecem nos orquestradores do shell
 * (`useSubmitCoreOrchestrator`, `usePhaseTransitionOrchestrator`, etc.).
 *
 * O componente apenas renderiza `null` (estado terminal sem UI), mas
 * existe como entrada explícita no `phaseComponentMap` para que o router
 * declarativo seja exaustivo e impeça fallback `null` silencioso em
 * impossible states.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DonePhaseProps {}

export const DonePhase = (_props: DonePhaseProps) => null;

export default DonePhase;
