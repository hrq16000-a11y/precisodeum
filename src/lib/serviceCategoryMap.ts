/**
 * Maps each service name to a visual category for hero background sync.
 */

export type ServiceCategory = 'instalacoes' | 'construcao' | 'tecnico' | 'beleza' | 'especializado' | 'casa';

export const CATEGORY_IMAGES: Record<ServiceCategory, string> = {
  instalacoes: '/hero-cat-instalacoes.jpg',
  construcao: '/hero-cat-construcao.jpg',
  tecnico: '/hero-cat-tecnico.jpg',
  beleza: '/hero-cat-beleza.jpg',
  especializado: '/hero-cat-especializado.jpg',
  casa: '/hero-cat-casa.jpg',
};

const SERVICE_TO_CATEGORY: Record<string, ServiceCategory> = {
  // Instalações & reparos
  'eletricista': 'instalacoes',
  'encanador': 'instalacoes',
  'instalador de ar-condicionado': 'instalacoes',
  'desentupidor': 'instalacoes',
  'chaveiro': 'instalacoes',
  'marido de aluguel': 'instalacoes',

  // Construção & reforma
  'pedreiro': 'construcao',
  'pintor': 'construcao',
  'gesseiro': 'construcao',
  'azulejista': 'construcao',
  'serralheiro': 'construcao',
  'soldador': 'construcao',
  'carpinteiro': 'construcao',
  'vidraceiro': 'construcao',

  // Técnico & manutenção
  'técnico em informática': 'tecnico',
  'técnico em celular': 'tecnico',
  'mecânico': 'tecnico',
  'eletricista automotivo': 'tecnico',
  'dedetizador': 'tecnico',
  'piscineiro': 'tecnico',

  // Beleza & saúde
  'profissional de beleza': 'beleza',
  'personal trainer': 'beleza',
  'nutricionista': 'beleza',
  'veterinário': 'beleza',

  // Serviços especializados
  'fotógrafo': 'especializado',
  'designer gráfico': 'especializado',
  'advogado': 'especializado',
  'contador': 'especializado',
  'arquiteto': 'especializado',
  'engenheiro civil': 'especializado',
  'professor particular': 'especializado',
  'motorista particular': 'especializado',

  // Casa & jardim
  'jardineiro': 'casa',
  'profissional de limpeza': 'casa',
  'montador de móveis': 'casa',
  'tapeceiro': 'casa',
  'cuidador de idosos': 'casa',
  'marceneiro': 'casa',
};

export function getCategoryForService(service: string): ServiceCategory {
  const lower = service.toLowerCase().trim();
  if (SERVICE_TO_CATEGORY[lower]) return SERVICE_TO_CATEGORY[lower];

  // Fuzzy match by keyword
  if (lower.includes('eletric')) return 'instalacoes';
  if (lower.includes('encanad') || lower.includes('hidráulic')) return 'instalacoes';
  if (lower.includes('pedreir') || lower.includes('pintor') || lower.includes('constru')) return 'construcao';
  if (lower.includes('técnic') || lower.includes('mecânic')) return 'tecnico';
  if (lower.includes('beleza') || lower.includes('cabel') || lower.includes('manic')) return 'beleza';
  if (lower.includes('foto') || lower.includes('design') || lower.includes('advog')) return 'especializado';
  if (lower.includes('jardin') || lower.includes('limpeza') || lower.includes('montad')) return 'casa';

  return 'instalacoes'; // default
}
