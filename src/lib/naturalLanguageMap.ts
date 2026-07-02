/**
 * AI Concierge — Client-side natural language → category slug mapping.
 * Maps everyday Portuguese phrases to category slugs for instant matching.
 */

const NLP_ENTRIES: [string[], string][] = [
  // Encanador / Plumber
  [['cano estourou', 'cano furado', 'vazamento', 'torneira pingando', 'descarga quebrou',
    'vaso entupido', 'pia entupida', 'ralo entupido', 'esgoto entupido', 'caixa d\'água',
    'registro quebrou', 'tubulação', 'bomba d\'água', 'falta água', 'água vazando',
    'encanamento'], 'encanador'],

  // Eletricista / Electrician
  [['tomada não funciona', 'fio desencapado', 'curto circuito', 'falta de luz',
    'disjuntor caindo', 'disjuntor desarmando', 'chuveiro não liga', 'instalação elétrica',
    'ventilador não funciona', 'luz piscando', 'tomada queimou', 'fio pelado',
    'quadro de força', 'energia caiu', 'interruptor quebrou'], 'eletricista'],

  // Pintor / Painter
  [['pintar parede', 'pintura', 'parede descascando', 'pintar casa', 'pintar apartamento',
    'pintar quarto', 'tinta descascou', 'parede suja', 'preciso pintar',
    'pintura externa', 'pintura interna', 'textura parede'], 'pintor'],

  // Pedreiro / Mason
  [['construir muro', 'levantar parede', 'reforma', 'reboco', 'contrapiso',
    'assentar piso', 'azulejo', 'calçada', 'laje', 'fundação',
    'ampliar casa', 'construção', 'demolição', 'rachadura parede'], 'pedreiro'],

  // Marceneiro / Carpenter
  [['armário planejado', 'móvel sob medida', 'porta emperrada', 'gaveta quebrou',
    'prateleira', 'móvel quebrou', 'guarda-roupa', 'cozinha planejada',
    'mesa de madeira', 'conserto de móvel'], 'marceneiro'],

  // Diarista / House Cleaner
  [['limpeza da casa', 'faxina', 'diarista', 'limpar apartamento',
    'limpeza pesada', 'limpar vidros', 'passar roupa', 'lavar roupa',
    'empregada doméstica', 'serviço doméstico'], 'diarista'],

  // Ar Condicionado / AC
  [['ar condicionado', 'ar não gela', 'instalar ar', 'manutenção ar',
    'split', 'ar pingando', 'ar fazendo barulho', 'limpar ar condicionado',
    'ar condicionado gelando pouco'], 'ar-condicionado'],

  // Serralheiro / Metalworker
  [['grade', 'portão', 'solda', 'ferro', 'grade de janela',
    'portão eletrônico', 'corrimão', 'estrutura metálica'], 'serralheiro'],

  // Telhado / Roofer
  [['goteira', 'telha quebrada', 'telhado', 'calha entupida', 'calha',
    'infiltração teto', 'forro', 'conserto telhado', 'trocar telha'], 'telhado'],

  // Jardineiro / Gardener
  [['cortar grama', 'podar árvore', 'jardinagem', 'jardim',
    'paisagismo', 'capina', 'limpeza de terreno'], 'jardineiro'],

  // Dedetizador / Pest Control
  [['barata', 'rato', 'cupim', 'dedetização', 'formiga',
    'escorpião', 'mosquito', 'pulga', 'praga', 'inseto'], 'dedetizacao'],

  // Vidraceiro / Glazier
  [['vidro quebrou', 'trocar vidro', 'box banheiro', 'espelho',
    'vidraçaria', 'porta de vidro', 'janela de vidro'], 'vidraceiro'],

  // Gesseiro / Plasterer
  [['gesso', 'sanca', 'forro de gesso', 'drywall',
    'moldura gesso', 'divisória'], 'gesseiro'],

  // Chaveiro / Locksmith
  [['chave quebrou', 'fechadura', 'tranquei chave dentro', 'perdi a chave',
    'trocar fechadura', 'cópia de chave', 'porta trancada'], 'chaveiro'],

  // Técnico informática
  [['computador lento', 'vírus', 'formatar pc', 'notebook não liga',
    'tela quebrada', 'internet não funciona', 'wifi não pega',
    'impressora não imprime'], 'informatica'],

  // Mudança / Moving
  [['mudança', 'carreto', 'frete', 'transportar móvel',
    'mudar de casa', 'caminhão de mudança'], 'mudanca'],

  // Marido de aluguel / Handyman
  [['marido de aluguel', 'pendurar quadro', 'instalar prateleira',
    'montar móvel', 'serviço geral', 'reparos gerais', 'pequenos reparos',
    'consertar porta', 'trocar lâmpada', 'instalar cortina',
    'instalar varal', 'pendurar tv'], 'marido-de-aluguel'],
];

export interface NlpMatch {
  phrase: string;
  categorySlug: string;
}

/**
 * Try to match a user query against known natural language phrases.
 * Returns the best match or null.
 */
export function matchNaturalLanguage(query: string): NlpMatch | null {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!q || q.length < 3) return null;

  for (const [phrases, slug] of NLP_ENTRIES) {
    for (const phrase of phrases) {
      const normalized = phrase.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (q.includes(normalized) || normalized.includes(q)) {
        return { phrase, categorySlug: slug };
      }
    }
  }
  return null;
}

/** Get example phrases for placeholder animation */
export const NLP_EXAMPLES = [
  'meu cano estourou',
  'tomada não funciona',
  'preciso pintar a casa',
  'goteira no telhado',
  'porta emperrada',
  'ar condicionado não gela',
  'montar um móvel',
];
