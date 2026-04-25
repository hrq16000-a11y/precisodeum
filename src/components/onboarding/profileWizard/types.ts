/**
 * Tipos compartilhados do ProfileWizard refatorado.
 *
 * O wizard suporta dois modos:
 *   - 'create': novo cadastro (passa por todos os passos, incluindo escolha PF/PJ)
 *   - 'edit'  : edição de perfil já existente (pula a escolha PF/PJ)
 */

export type WizardMode = 'create' | 'edit';

/** Tipo de perfil suportado no cadastro profissional. */
export type ProfileKind = 'pf' | 'pj';

/**
 * Estrutura mínima dos dados do profissional manipulados pelo wizard.
 * Mantida intencionalmente enxuta — campos legados continuam vivendo
 * no SmartOnboardingWizard até a migração total ser concluída.
 */
export interface ProfileWizardData {
  id?: string;
  kind: ProfileKind;            // PF ou PJ
  full_name: string;
  whatsapp: string;             // somente dígitos (ex: 5541997452053)
  document: string;             // CPF (11) ou CNPJ (14), somente dígitos
  category: string;             // slug da categoria principal ('all' = não escolhida)
  bio: string;
  avatar_url: string | null;
  city: string;
  state: string;                // UF normalizada (2 letras maiúsculas)
}

/** Props públicas do componente ProfileWizard. */
export interface ProfileWizardProps {
  mode: WizardMode;
  /** Dados iniciais para popular o formulário (obrigatório em 'edit'). */
  initialData?: Partial<ProfileWizardData>;
  /** Disparado quando o usuário conclui (create) ou salva (edit). */
  onFinish?: (data: ProfileWizardData) => void | Promise<void>;
  /** Callback opcional para fechar/cancelar o wizard. */
  onCancel?: () => void;
}

/** Resultado do cálculo de completude (Frente 2). */
export interface WizardCompletenessResult {
  /** Percentual 0–100 (inteiro). */
  percentage: number;
  /** Lista de campos faltantes na ordem em que devem ser resolvidos. */
  missing: WizardMissingField[];
  /** Pesos aplicados (debug/telemetria). */
  weights: Record<WizardScoredField, number>;
}

export type WizardScoredField =
  | 'full_name'
  | 'whatsapp'
  | 'category'
  | 'bio'
  | 'avatar'
  | 'location';

export interface WizardMissingField {
  field: WizardScoredField;
  label: string;
  weight: number;
}
