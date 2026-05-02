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
  years_experience: number | null;
  neighborhood: string;         // opcional, Fase 4
  bio: string;                  // opcional, Fase 4
  instagram_url: string;        // opcional, Fase 4
  facebook_url: string;         // opcional, Fase 4
  /** Site/portfólio próprio (URL livre) — opcional, Fase 4. Visível publicamente no perfil. */
  website_url?: string;
  /** Categoria escolhida na Fase 2 — herda automaticamente para o perfil. */
  primary_category_id: string | null;
  /** Horários escolhidos na Fase 2 — herda automaticamente para o perfil. */
  working_hours: string;

  // ---- PJ-only (institucional). Persistidos no draft remoto p/ não perder em troca de dispositivo.
  /** Logradouro (Rua/Av) — opcional, só PJ. */
  street?: string;
  /** Número do endereço — opcional, só PJ. */
  street_number?: string;
  /** Complemento — opcional, só PJ. */
  complement?: string;
  /** CEP (somente dígitos) — opcional, só PJ. */
  postal_code?: string;
  /** Segmento de negócio — opcional, só PJ. */
  business_segment?: string;
  /** Razão social / nome da empresa — opcional, só PJ. Hidratado em modo revisão. */
  company_name?: string;
  /** Toggle de privacidade do endereço completo — só PJ. */
  show_full_address?: boolean;
  /** Última sugestão de logradouro vinda do CEP (BrasilAPI/ViaCEP) — só UX, não persistida. */
  street_suggested?: string;
  /** CEP (8 dígitos) que originou a sugestão atual — auditoria/telemetria; evita sobrescrita após edição manual. */
  street_suggested_cep?: string;
  /** Bairro sugerido pelo último CEP consultado — persistido para reuso entre steps do wizard. */
  bairro_sugerido_cep?: string;
  /** Confirmação explícita do logradouro pelo usuário — só UX, não persistida. */
  street_confirmed?: boolean;
  /** Histórico recente de CEPs consultados (LRU, máx 3). Persiste entre steps do wizard. */
  cep_history?: Array<{ cep: string; digits: string; address?: string; city?: string; state?: string }>;
  /** Redes sociais institucionais (chave→URL) — só PJ. */
  social_links?: Record<string, string> | null;
  /** Persistido no BetState: usuário marcou "Ficar ONLINE" no upsell de documento. Default true. */
  go_online?: boolean;
  /** Origem do avatar atual: upload manual, câmera, foto da conta social, ou gerado pelo sistema. */
  avatar_source?: 'upload' | 'camera' | 'social' | 'generated' | null;
  /** Seed/variante do avatar gerado — permite "trocar cores" e restaurar a mesma escolha ao voltar. */
  avatar_seed?: number;
  /** Latitude capturada via GPS/CEP — alimenta a coluna `geog` (PostGIS) em `providers`. */
  latitude?: number | null;
  /** Longitude capturada via GPS/CEP — alimenta a coluna `geog` (PostGIS) em `providers`. */
  longitude?: number | null;
  /** Precisão do GPS em metros (opcional, telemetria/auditoria). */
  accuracy_m?: number | null;
}

export type OnboardingCoreField = 'full_name' | 'whatsapp' | 'city' | 'state' | 'document';

export interface OnboardingFirstServiceData {
  service_name: string;          // herdado da categoria escolhida (auto)
  description: string;           // descrição curta do serviço
  category_ids: string[];        // 1 obrigatório, multi opcional
  cities_served: string[];       // máx 5
  starting_price_brl: number | null; // "Valores (a partir de)"
  working_days: string[];
  working_hours: string;
  /** Estrutura controlada (Google Meu Negócio): { ranges: [...] }. Substitui
   *  texto livre — o resumo de `working_hours` passa a ser derivado dela. */
  working_hours_struct?: { ranges: Array<{ days: string[]; start: string; end: string }> } | null;
}

export type OnboardingPhase =
  | 'phase2_service'       // Step 5 — Categoria + Título do serviço
  | 'phase2_details'       // Step 6 — Cidades, Valores (a partir de), Horários
  | 'phase2_photos'        // Step 6.5 — Upload de até 5 fotos (1 capa)
  | 'phase3_celebration'   // Step 7 — Tela de Sucesso
  | 'phase4_document'      // Step 8 — Upsell CPF/CNPJ
  | 'phase4_avatar'        // Step 8.5 — Foto de perfil (se ainda faltar)
  | 'phase4_extras_a'      // Step 9 — Bairro + Bio
  | 'phase4_extras_b'      // Step 10 — Redes sociais
  | 'done';

/** Fases que NUNCA podem ser puladas (regra do prompt).
 *  Nome+WhatsApp agora são exigidos pela triagem (Bet Mode), antes de
 *  qualquer fase `main_*`/`phase2_*`. Mantemos o Set vazio aqui por
 *  compat de assinatura. */
export const REQUIRED_PHASES: ReadonlySet<OnboardingPhase> = new Set<OnboardingPhase>();

export interface OnboardingState {
  profile: OnboardingProfileData;
  service: OnboardingFirstServiceData;
  phase: OnboardingPhase;
  /** user_ref imutável do profissional, usado para reidratar vínculo com records já existentes. */
  userRef: string | null;
  /** providerId criado/atualizado durante a Fase 1. */
  providerId: string | null;
  /** serviceId criado durante a Fase 2. */
  firstServiceId: string | null;
}
