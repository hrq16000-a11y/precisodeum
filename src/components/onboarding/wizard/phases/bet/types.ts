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
  /** Coordenadas da cidade-base (GPS preciso ou centro do CEP). Persistidas no draft. */
  latitude: number | null;
  longitude: number | null;
  /** Código IBGE do município (quando disponível via CEP/normalização). */
  ibge_code: string | null;
  /** Origem da localização atualmente persistida. */
  location_source: 'gps' | 'cep' | 'ip' | 'manual' | null;
  pro_kind: BetProKind | null;
  document: string;            // CPF (11) ou CNPJ (14)
  company_name: string;        // PJ apenas
  /** PJ — endereço institucional opcional ("ponto de atendimento físico"). */
  street: string;
  street_number: string;
  complement: string;
  postal_code: string;
  /** PJ — toggle de privacidade. Se true exibe rua/nº no card; se false só bairro/cidade. */
  show_full_address: boolean;
  points: number;              // contador exibido
  rewards: {
    name: boolean;
    whatsapp: boolean;
    intent: boolean;
    city: boolean;
    pro_kind: boolean;
    document: boolean;
  };
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
  street: '',
  street_number: '',
  complement: '',
  postal_code: '',
  show_full_address: false,
  points: 0,
  rewards: {
    name: false,
    whatsapp: false,
    intent: false,
    city: false,
    pro_kind: false,
    document: false,
  },
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
