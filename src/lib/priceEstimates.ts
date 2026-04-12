/**
 * Static price estimate ranges per category slug.
 * Values represent typical market ranges in BRL.
 */
export const PRICE_ESTIMATES: Record<string, { min: number; max: number; unit: string }> = {
  encanador: { min: 150, max: 450, unit: 'serviço' },
  eletricista: { min: 120, max: 400, unit: 'serviço' },
  pintor: { min: 800, max: 3500, unit: 'cômodo' },
  pedreiro: { min: 200, max: 600, unit: 'diária' },
  marceneiro: { min: 500, max: 5000, unit: 'projeto' },
  diarista: { min: 120, max: 250, unit: 'diária' },
  'ar-condicionado': { min: 200, max: 600, unit: 'serviço' },
  serralheiro: { min: 300, max: 2500, unit: 'projeto' },
  telhado: { min: 250, max: 1500, unit: 'serviço' },
  jardineiro: { min: 100, max: 350, unit: 'visita' },
  dedetizacao: { min: 150, max: 500, unit: 'aplicação' },
  vidraceiro: { min: 200, max: 800, unit: 'serviço' },
  gesseiro: { min: 300, max: 2000, unit: 'projeto' },
  chaveiro: { min: 80, max: 300, unit: 'serviço' },
  informatica: { min: 100, max: 400, unit: 'atendimento' },
  mudanca: { min: 300, max: 2000, unit: 'mudança' },
  'marido-de-aluguel': { min: 100, max: 350, unit: 'visita' },
};

export function getPriceEstimate(categorySlug: string) {
  return PRICE_ESTIMATES[categorySlug] || null;
}
