/** Bet Mode V3 — tipos do estado central. */
export type BetIntent = 'client' | 'professional' | 'rh' | 'sponsor';
export type BetProKind = 'pf' | 'pj';

export type BetPhase =
  | 'identity'         // Nome + WhatsApp
  | 'who'              // Sou Profissional / Sou Cliente
  | 'client_city'      // Cliente: cidade e pronto
  | 'pro_kind'         // Profissional: PF ou PJ
  | 'pro_document'     // CPF (PF) ou CNPJ + Nome Fantasia (PJ)
  | 'pro_location'     // Cidade do profissional
  | 'celebration'      // Tela de conquista + redirect para wizard pleno
  | 'done';

export interface BetState {
  full_name: string;
  whatsapp: string;            // somente dígitos
  intent: BetIntent | null;
  city: string;
  state: string;
  neighborhood: string;        // bairro — necessário para anúncio aparecer
  pro_kind: BetProKind | null;
  document: string;            // CPF (11) ou CNPJ (14)
  company_name: string;        // PJ apenas
  points: number;              // contador exibido
  phase: BetPhase;
}

export const initialBetState: BetState = {
  full_name: '',
  whatsapp: '',
  intent: null,
  city: '',
  state: '',
  neighborhood: '',
  pro_kind: null,
  document: '',
  company_name: '',
  points: 0,
  phase: 'identity',
};

/** Pontos por marco — lê como recompensa visual. */
export const BET_POINTS = {
  name: 50,
  whatsapp: 150,
  intent: 100,
  city: 100,
  pro_kind: 100,
  cpf_badge: 500,
  cnpj_badge: 1000,
} as const;
