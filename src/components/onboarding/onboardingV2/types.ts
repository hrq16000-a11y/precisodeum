/**
 * OnboardingV2 — tipos do estado central unificado.
 *
 * Reescrita do ProfileWizard com fluxo "Progressive Disclosure":
 *   Fase 1 — O Mínimo para Existir (Atuação → PF/PJ → Local+Foto → Nome+WhatsApp)
 *   Fase 2 — Criação Expressa do 1º Serviço (Categoria/Título + Cidades/Valores/Horários)
 *   Fase 3 — Celebração (placar correndo + som de conquista)
 *   Fase 4 — Coleta Subliminar (CPF/CNPJ ONLINE + micro-telas Bairro/Bio/Redes)
 *
 * "Regra de Ouro da Memória": dados capturados em uma fase NUNCA são
 * pedidos novamente — categoria/horário do Step 2 herdam para o perfil.
 */

export type AccountKind = 'pf' | 'pj';
export type ProfileTypeChoice = 'provider' | 'client' | 'rh' | 'sponsor';

export interface OnboardingProfileData {
  profile_type?: ProfileTypeChoice;
  kind: AccountKind;            // PF (CPF) ou PJ (CNPJ)
  full_name: string;
  whatsapp: string;             // somente dígitos
  document: string;             // CPF (11) ou CNPJ (14), opcional até Fase 4
  city: string;
  state: string;                // UF normalizada (2 letras maiúsculas)
  avatar_url: string | null;
  neighborhood: string;         // opcional, Fase 4
  bio: string;                  // opcional, Fase 4
  instagram_url: string;        // opcional, Fase 4
  facebook_url: string;         // opcional, Fase 4
  /** Categoria escolhida na Fase 2 — herda automaticamente para o perfil. */
  primary_category_id: string | null;
  /** Horários escolhidos na Fase 2 — herda automaticamente para o perfil. */
  working_hours: string;
}

export interface OnboardingFirstServiceData {
  service_name: string;
  category_ids: string[];       // 1 obrigatório, multi opcional
  cities_served: string[];      // máx 5
  starting_price_brl: number | null; // "Valores (a partir de)"
  working_hours: string;
}

export type OnboardingPhase =
  | 'phase1_action'        // Step 1 — Atuação
  | 'phase1_kind'          // Step 2 — PF / PJ
  | 'phase1_location'      // Step 3 — Localização + Foto
  | 'phase1_contact'       // Step 4 — Nome + WhatsApp
  | 'phase2_service'       // Step 5 — Categoria + Título do serviço
  | 'phase2_details'       // Step 6 — Cidades, Valores (a partir de), Horários
  | 'phase2_photos'        // Step 6.5 — Upload de até 5 fotos (1 capa)
  | 'phase3_celebration'   // Step 7 — Tela de Sucesso
  | 'phase4_document'      // Step 8 — Upsell CPF/CNPJ
  | 'phase4_extras_a'      // Step 9 — Bairro + Bio
  | 'phase4_extras_b'      // Step 10 — Redes sociais
  | 'done';

/** Fases que NUNCA podem ser puladas (regra do prompt). */
export const REQUIRED_PHASES: ReadonlySet<OnboardingPhase> = new Set([
  'phase1_contact',  // Nome + WhatsApp
]);

export interface OnboardingState {
  profile: OnboardingProfileData;
  service: OnboardingFirstServiceData;
  phase: OnboardingPhase;
  /** providerId criado/atualizado durante a Fase 1. */
  providerId: string | null;
  /** serviceId criado durante a Fase 2. */
  firstServiceId: string | null;
}
