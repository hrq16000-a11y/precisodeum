/**
 * Intelligent Job Text Parser
 * Extracts structured fields from free-text job postings.
 */

import { normalize } from '@/lib/geoUtils';
import { sanitizePhone } from '@/lib/whatsapp';

export interface ParsedJob {
  title: string;
  subtitle: string;
  description: string;
  category_id: string;
  categoryName: string;
  opportunity_type: string;
  job_type: string;
  work_model: string;
  activities: string;
  requirements: string;
  benefits: string;
  schedule: string;
  salary: string;
  city: string;
  state: string;
  neighborhood: string;
  contact_name: string;
  contact_phone: string;
  whatsapp: string;
  detectedFields: string[];
}

interface Category {
  id: string;
  name: string;
}

/* ── helpers ─────────────────────────────────────────────── */

const SECTION_PATTERNS: Record<string, RegExp> = {
  activities: /^(?:atividades|responsabilidades|funções|fun[çc][õo]es|o que voc[êe] vai fazer|atribuições|tarefas)[:\s-]*/i,
  requirements: /^(?:requisitos|exig[êe]ncias|qualificações|qualifica[çc][õo]es|perfil desejado|necess[áa]rio|obrigat[óo]rio|pr[ée]-requisitos)[:\s-]*/i,
  benefits: /^(?:benef[íi]cios|oferecemos|o que oferecemos|vantagens)[:\s-]*/i,
  schedule: /^(?:hor[áa]rio|jornada|carga hor[áa]ria|escala|turno)[:\s-]*/i,
  description: /^(?:descri[çc][ãa]o|sobre a vaga|sobre|detalhes|informa[çc][õo]es)[:\s-]*/i,
};

const JOB_TYPE_MAP: [RegExp, string][] = [
  [/\bclt\b/i, 'clt'],
  [/\b(?:pj|pessoa jur[ií]dica|aut[oô]nomo)\b/i, 'pj'],
  [/\best[áa]gio\b/i, 'estagio'],
  [/\btemporário\b/i, 'temporario'],
  [/\baprendiz\b/i, 'aprendiz'],
  [/\bfreelance?r?\b/i, 'freelance'],
  [/\bmeio[\s-]?per[ií]odo\b/i, 'meio-periodo'],
];

const WORK_MODEL_MAP: [RegExp, string][] = [
  [/\b(?:remoto|home[\s-]?office|trabalho remoto)\b/i, 'remoto'],
  [/\bh[ií]brido\b/i, 'hibrido'],
  [/\bpresencial\b/i, 'presencial'],
];

const OPPORTUNITY_MAP: [RegExp, string][] = [
  [/\b(?:emprego|contrata[çc][ãa]o|contratamos)\b/i, 'emprego'],
  [/\bfreelance?\b/i, 'freelance'],
  [/\b(?:servi[çc]o|preciso de|procuro)\b/i, 'servico'],
];

const STATE_MAP: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM',
  'bahia': 'BA', 'ceara': 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES',
  'goias': 'GO', 'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', 'para': 'PA', 'paraiba': 'PB', 'parana': 'PR',
  'pernambuco': 'PE', 'piaui': 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', 'rondonia': 'RO',
  'roraima': 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP',
  'sergipe': 'SE', 'tocantins': 'TO',
};

const UF_LIST = Object.values(STATE_MAP);

/* ── core parser ─────────────────────────────────────────── */

export function parseJobText(text: string, categories: Category[]): ParsedJob {
  const detected: string[] = [];
  const lines = text.split('\n').map(l => l.trim());
  const fullNorm = normalize(text);

  // ── Title ──
  let title = '';
  for (const line of lines) {
    if (!line) continue;
    title = line.replace(/^(?:vaga|título|cargo|posição|oportunidade)[:\s-]*/i, '').trim();
    break;
  }
  if (title) detected.push('Título');

  // ── Sections ──
  const sections: Record<string, string[]> = {};
  let currentSection: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) { currentSection = null; continue; }

    let matched = false;
    for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(line)) {
        currentSection = key;
        const remainder = line.replace(pattern, '').trim();
        sections[key] = remainder ? [remainder] : [];
        matched = true;
        break;
      }
    }
    if (!matched && currentSection) {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }
  }

  const activities = sections.activities?.join('\n') || '';
  const requirements = sections.requirements?.join('\n') || '';
  const benefits = sections.benefits?.join('\n') || '';
  const schedule = sections.schedule?.join(' ').trim() || '';

  if (activities) detected.push('Atividades');
  if (requirements) detected.push('Requisitos');
  if (benefits) detected.push('Benefícios');
  if (schedule) detected.push('Horário');

  // ── Description (everything not in a named section) ──
  const descriptionParts: string[] = [];
  let inSection = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let isHeader = false;
    for (const pattern of Object.values(SECTION_PATTERNS)) {
      if (pattern.test(line)) { isHeader = true; inSection = true; break; }
    }
    if (isHeader) continue;
    if (!line) { inSection = false; continue; }
    if (!inSection) descriptionParts.push(line);
  }
  const description = descriptionParts.join('\n') || text;

  // ── Category (fuzzy match) ──
  let category_id = '';
  let categoryName = '';
  let bestScore = 0;

  for (const cat of categories) {
    const catNorm = normalize(cat.name);
    const catWords = catNorm.split(/\s+/);
    
    // Exact substring match in title or full text
    if (fullNorm.includes(catNorm) || normalize(title).includes(catNorm)) {
      const score = catNorm.length * 2;
      if (score > bestScore) {
        bestScore = score;
        category_id = cat.id;
        categoryName = cat.name;
      }
    } else {
      // Word-level partial match
      const matchedWords = catWords.filter(w => w.length > 3 && fullNorm.includes(w));
      const score = matchedWords.length / catWords.length;
      if (score >= 0.6 && score * catNorm.length > bestScore) {
        bestScore = score * catNorm.length;
        category_id = cat.id;
        categoryName = cat.name;
      }
    }
  }
  if (category_id) detected.push(`Categoria: ${categoryName}`);

  // ── Job Type ──
  let job_type = '';
  for (const [pat, val] of JOB_TYPE_MAP) {
    if (pat.test(text)) { job_type = val; break; }
  }
  if (job_type) detected.push(job_type.toUpperCase());

  // ── Work Model ──
  let work_model = '';
  for (const [pat, val] of WORK_MODEL_MAP) {
    if (pat.test(text)) { work_model = val; break; }
  }
  if (work_model) detected.push(work_model.charAt(0).toUpperCase() + work_model.slice(1));

  // ── Opportunity Type ──
  let opportunity_type = 'servico';
  for (const [pat, val] of OPPORTUNITY_MAP) {
    if (pat.test(text)) { opportunity_type = val; break; }
  }

  // ── City / State ──
  let city = '';
  let state = '';

  // Pattern: "Local: Curitiba - PR" or "Cidade: São Paulo/SP"
  const cityPatterns = [
    /(?:local|cidade|localiza[çc][ãa]o|regi[ãa]o|endere[çc]o)[:\s]*([^,\n]+?)[\s]*[-–/][\s]*([A-Z]{2})\b/i,
    /(?:local|cidade|localiza[çc][ãa]o)[:\s]*([^,\n]+?),?\s*([A-Z]{2})\b/i,
    /\b([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:de|do|da|dos|das|e)\s+[A-ZÀ-Ú]?[a-zà-ú]+)*)\s*[-–/]\s*([A-Z]{2})\b/,
  ];

  for (const pat of cityPatterns) {
    const m = text.match(pat);
    if (m) {
      const candidateState = m[2].toUpperCase();
      if (UF_LIST.includes(candidateState)) {
        city = m[1].trim();
        state = candidateState;
        break;
      }
    }
  }

  // Fallback: detect state name
  if (!state) {
    for (const [name, uf] of Object.entries(STATE_MAP)) {
      if (fullNorm.includes(name)) {
        state = uf;
        break;
      }
    }
  }

  if (city) detected.push(`Cidade: ${city}`);
  if (state && !city) detected.push(`Estado: ${state}`);

  // ── Neighborhood ──
  let neighborhood = '';
  const nbMatch = text.match(/(?:bairro|regi[ãa]o|setor)[:\s]*([^\n,]+)/i);
  if (nbMatch) {
    neighborhood = nbMatch[1].trim();
    detected.push('Bairro');
  }

  // ── Salary ──
  let salary = '';
  const salaryPatterns = [
    /(?:sal[áa]rio|remunera[çc][ãa]o|valor|pagamento)[:\s]*([^\n]+)/i,
    /R\$\s*[\d.,]+(?:\s*(?:a|até|~)\s*R?\$?\s*[\d.,]+)?/i,
    /\ba\s+combinar\b/i,
  ];
  for (const pat of salaryPatterns) {
    const m = text.match(pat);
    if (m) {
      salary = m[1]?.trim() || m[0].trim();
      break;
    }
  }
  if (salary) detected.push('Salário');

  // ── Schedule (fallback from patterns if not from section) ──
  let scheduleFinal = schedule;
  if (!scheduleFinal) {
    const schMatch = text.match(/(?:hor[áa]rio|jornada|escala|turno)[:\s]*([^\n]+)/i);
    if (schMatch) {
      scheduleFinal = schMatch[1].trim();
      if (!detected.includes('Horário')) detected.push('Horário');
    }
  }

  // ── Contact ──
  let contact_name = '';
  const contactMatch = text.match(/(?:contato|falar com|respons[áa]vel|enviar cv para|nome)[:\s]*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){0,3})/i);
  if (contactMatch) {
    contact_name = contactMatch[1].trim();
    detected.push('Contato');
  }

  // ── Phone / WhatsApp ──
  let whatsapp = '';
  let contact_phone = '';
  const phonePatterns = [
    /(?:whatsapp|wpp|zap)[:\s]*([\d\s()+-]+)/i,
    /(?:telefone|fone|tel|celular)[:\s]*([\d\s()+-]+)/i,
  ];
  for (const pat of phonePatterns) {
    const m = text.match(pat);
    if (m) {
      const sanitized = sanitizePhone(m[1]);
      if (sanitized.length >= 10) {
        if (pat === phonePatterns[0]) {
          whatsapp = sanitized;
        } else {
          contact_phone = sanitized;
        }
      }
    }
  }
  // Also find standalone phone numbers
  if (!whatsapp && !contact_phone) {
    const standalone = text.match(/\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/);
    if (standalone) {
      const sanitized = sanitizePhone(standalone[0]);
      if (sanitized.length >= 10) {
        whatsapp = sanitized;
      }
    }
  }
  if (whatsapp) detected.push('WhatsApp');
  if (contact_phone && !whatsapp) { whatsapp = contact_phone; detected.push('Telefone'); }

  return {
    title,
    subtitle: '',
    description,
    category_id,
    categoryName,
    opportunity_type,
    job_type,
    work_model,
    activities,
    requirements,
    benefits,
    schedule: scheduleFinal,
    salary,
    city,
    state,
    neighborhood,
    contact_name,
    contact_phone,
    whatsapp,
    detectedFields: detected,
  };
}
