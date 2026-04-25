import type { MaturityTier } from '@/hooks/useMaturityTier';

export type MissionAnswer = string | boolean | string[] | null;

export interface Mission {
  /** Chave única, gravada em providers.mission_answers[key]. */
  key: string;
  /** Tiers que veem essa missão. */
  tiers: MaturityTier[];
  /** Pergunta exibida no card. */
  question: string;
  /** Subtítulo curto explicando o benefício de responder. */
  benefit: string;
  /** Tipo de resposta. */
  type: 'yes_no' | 'choice';
  /** Para 'choice': opções com label e value. */
  options?: { label: string; value: string }[];
  /**
   * Mapeamento opcional para colunas em providers/profiles que devem ser
   * sincronizadas via triggers existentes (operational data).
   * Ex.: { column: 'serves_companies', table: 'providers' } se quisermos
   * promover de jsonb para coluna no futuro.
   */
}

/**
 * Lista canônica de missões do Dashboard Evolutivo.
 * Edite aqui para adicionar/remover sem mexer em UI.
 */
export const MISSIONS: Mission[] = [
  {
    key: 'portfolio_complete',
    tiers: ['novato'],
    question: 'Complete seu portfólio com pelo menos 3 fotos',
    benefit: 'Profissionais com portfólio recebem 10% mais visualizações.',
    type: 'yes_no',
  },
  {
    key: 'serves_companies',
    tiers: ['explorador'],
    question: 'Você atende empresas (PJ)?',
    benefit: 'Marcamos seu perfil como apto para clientes corporativos.',
    type: 'yes_no',
  },
  {
    key: 'emits_invoice',
    tiers: ['explorador', 'ativo'],
    question: 'Você emite Nota Fiscal?',
    benefit: 'Clientes corporativos preferem profissionais que emitem NF.',
    type: 'yes_no',
  },
  {
    key: 'tools_owned',
    tiers: ['ativo'],
    question: 'Você possui suas próprias ferramentas?',
    benefit: 'Aumenta a confiança em emergências.',
    type: 'choice',
    options: [
      { label: 'Sim, kit completo', value: 'full' },
      { label: 'Tenho algumas', value: 'partial' },
      { label: 'Não, alugo quando preciso', value: 'rent' },
    ],
  },
  {
    key: 'service_radius',
    tiers: ['ativo', 'veterano'],
    question: 'Qual seu raio máximo de atendimento?',
    benefit: 'Aparece em buscas mais distantes que combinem com você.',
    type: 'choice',
    options: [
      { label: 'Só meu bairro', value: 'neighborhood' },
      { label: 'Toda a cidade', value: 'city' },
      { label: 'Cidade + região metropolitana', value: 'metro' },
      { label: 'Estado inteiro', value: 'state' },
    ],
  },
];

export function getMissionsForTier(tier: MaturityTier): Mission[] {
  return MISSIONS.filter((m) => m.tiers.includes(tier));
}
