/**
 * EditModeSkipButton — DESATIVADO por solicitação do usuário.
 * O botão global "Pular esta etapa" não deve aparecer em nenhum lugar
 * do Wizard/Assistente. Mantemos o componente como no-op para preservar
 * imports existentes sem quebrar a build.
 */
import type { WizardState, UnifiedPhase } from './wizardReducer';

interface Props {
  state: WizardState;
  phase: UnifiedPhase;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function EditModeSkipButton(_props: Props) {
  return null;
}
