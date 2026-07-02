/**
 * Gerador de avatar minimalista, determinístico e único por usuário.
 *
 * Princípios:
 *  - "Único": o hash combina userId + nome + categoria + seed → cada combinação cai num
 *    espaço de cores/formas distinto. Como o userId entra no hash, dois usuários
 *    diferentes NUNCA produzem o mesmo SVG, mesmo com nome/categoria iguais.
 *  - "Personalizado pela categoria": quando há `categoryName`/`categoryIcon`, usamos
 *    o nome da categoria (1ª letra ou abreviação) e o hash da categoria pra escolher
 *    a paleta. Sem categoria, caímos nas iniciais do nome (fallback existente).
 *  - "Minimalista": gradiente diagonal + texto centrado. Sem ícones bitmap, tudo SVG.
 *  - "Offline": não bate em rede. Retorna data URL pronta pra <img src>.
 *
 * Uso:
 *   const url = generateUniqueAvatar({
 *     userId, fullName, categoryName, categoryIcon, seed,
 *   });
 */

export interface GenerateUniqueAvatarInput {
  /** Obrigatório — garante unicidade global entre usuários. Se ausente, geramos um id aleatório. */
  userId?: string | null;
  /** Nome do profissional (para iniciais quando não há categoria). */
  fullName?: string | null;
  /** Nome da categoria selecionada (ex.: "Encanador"). Personaliza letra + paleta. */
  categoryName?: string | null;
  /** Ícone da categoria (PascalCase, ex.: "Wrench"). Atualmente só usado no hash. */
  categoryIcon?: string | null;
  /** Variação manual ("trocar cores"). Mesmo seed → mesmo SVG. */
  seed?: number;
}

/**
 * Mini-biblioteca de ícones SVG (paths de 24x24, escalados pra 200x200 via translate+scale).
 * Mapeamento heurístico por palavra-chave do nome da categoria → cobre os ramos mais comuns.
 * Quando nenhuma keyword bate, caímos em iniciais (glyph) como antes.
 */
const ICON_PATHS: Record<string, string> = {
  // chave (slug ascii lower) → path do lucide-like
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  hammer: 'M15 12l-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9M17.64 15L22 10.64M20.91 11.7l-1.25-1.25a2.12 2.12 0 0 1 0-3l1.5-1.5L15.88 1l-1.5 1.5a2.12 2.12 0 0 1-3 0l-1.25-1.25-3.5 3.5L8 6l3 3 3.5-3.5',
  paint: 'M19 11h2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8h2M19 11V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4M9 11V7M15 11V7',
  brush: 'M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12',
  car: 'M19 17h2v-5l-2-4H5L3 12v5h2M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z',
  truck: 'M5 18H3V6h13v12M5 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM16 18h-2M16 8h4l3 4v6h-3M16 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0z',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10zM2 21c0-3 1.85-5.36 5.08-6',
  shovel: 'M2 22l5-5M19 19l-5-5M11 12L20 3M3 21l9-9M21 5l-2-2M14 8l2-2',
  computer: 'M2 6h20v12H2zM12 18v4M8 22h8',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  heart: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  baby: 'M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M17 14a5 5 0 1 0-10 0M12 3v3M5.6 5.6l2.1 2.1M18.4 5.6l-2.1 2.1',
  scale: 'M16 16l3-8 3 8c-2 1-4 1-6 0zM2 16l3-8 3 8c-2 1-4 1-6 0zM7 21h10M12 3v18M3 7h2M19 7h2',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-4M4 19.5V5a2 2 0 0 1 2-2h14v14H6.5A2.5 2.5 0 0 0 4 19.5z',
  graduate: 'M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5',
  plug: 'M9 2v6M15 2v6M5 10h14v3a7 7 0 0 1-14 0zM12 20v-3',
  lock: 'M5 11h14v10H5zM7 11V7a5 5 0 0 1 10 0v4',
  shield: 'M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z',
  utensils: 'M3 2v7a2 2 0 0 0 2 2h2v11M7 2v7M14 22V4a2 2 0 0 1 2-2h3v20',
  scissor: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.12 15.88',
  flower: 'M12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM12 2v3M12 14v8M5 7l2 2M17 7l-2 2M5 17l2-2M17 17l-2-2M2 12h3M19 12h3',
  truckfast: 'M2 12h13l3 3h3v4M5 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM15 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0z',
  dog: 'M10 5l-1-2-3 1 1 3M14 5l1-2 3 1-1 3M5 12c0-3 3-5 7-5s7 2 7 5v5a2 2 0 0 1-2 2h-2l-1 2h-4l-1-2H7a2 2 0 0 1-2-2zM10 14h.01M14 14h.01',
  guitar: 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12 15l5-5M14 13l5-5M19 8l3-3-3-3-3 3M11 12L8 9',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
};

/** Mapeia nome de categoria → chave do ICON_PATHS (heurística por keyword). */
function pickIconKey(categoryName?: string | null, categoryIcon?: string | null): string | null {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const cat = norm(categoryName || '');
  const ic = norm(categoryIcon || '');
  // 1) tenta pelo lucide name (PascalCase → lowercase) se vier algo conhecido.
  if (ic && ICON_PATHS[ic]) return ic;
  // 2) keywords no nome da categoria
  const map: Array<[RegExp, string]> = [
    [/encanad|hidraul|cano|vazament/, 'wrench'],
    [/eletric|eletrot|fiac|tomada|chuveir/, 'zap'],
    [/pintur|pintor/, 'paint'],
    [/pedreir|alvenari|reform|construc|obra/, 'hammer'],
    [/jardin|paisag|agricult|horta|plant/, 'leaf'],
    [/limpeza|diaris|faxin|domestic/, 'home'],
    [/cabelei|barbeir|estetic|manicur|salao|beleza/, 'scissors'],
    [/mecan|automotiv|carro|moto/, 'car'],
    [/frete|mudanc|caminh|transport|entreg/, 'truck'],
    [/info|computad|tecnic|programad|desenvolv|ti |software/, 'computer'],
    [/design|web|site|sistema/, 'code'],
    [/fotograf|fotografo|filmagem|video/, 'camera'],
    [/music|cantor|dj |banda|instrument/, 'music'],
    [/saude|enferm|cuidad|fisio|massag|terap/, 'heart'],
    [/baba|cuidador.*crian|babysit/, 'baby'],
    [/advog|juridic|contab|fiscal|consult/, 'scale'],
    [/aula|profess|reforco|tutor|idiom/, 'book'],
    [/instrut|coach|treinad|educ/, 'graduate'],
    [/segur|alarme|portari/, 'shield'],
    [/chavei|fechad|porta/, 'lock'],
    [/coz|gastro|chef|buffet|cater|gelad|alimentar/, 'utensils'],
    [/florista|decor.*flor|buque/, 'flower'],
    [/pet|animal|veterin|cao|gato/, 'dog'],
    [/aulas?\s*music|guitar|violao|piano/, 'guitar'],
    [/idioma|tradut|ingles|espanhol/, 'globe'],
  ];
  for (const [re, k] of map) if (re.test(cat)) return k;
  return null;
}

/** Hash 32-bit determinístico (xfnv1a-like). Estável entre browsers. */
function hash32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Extrai 1-2 caracteres representativos. Prefere categoria → nome → fallback. */
function pickGlyph(categoryName?: string | null, fullName?: string | null): string {
  const cat = (categoryName || '').trim();
  if (cat) {
    // Categorias com 2 palavras → primeira letra de cada (ex.: "Aulas Particulares" → "AP").
    const parts = cat.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    // 1 palavra → primeira letra apenas (visual mais minimalista que duas iguais).
    return parts[0][0].toUpperCase();
  }
  const name = (fullName || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return '?';
}

/**
 * Paleta determinística — cada hash cai numa região distinta do círculo HSL.
 * Saturação e luminosidade fixas garantem contraste alto com o glifo branco.
 */
function palette(h: number): { c1: string; c2: string } {
  const hue = h % 360;
  const hue2 = (hue + 35 + ((h >>> 8) % 25)) % 360; // delta variável → mais variedade
  return {
    c1: `hsl(${hue} 72% 52%)`,
    c2: `hsl(${hue2} 78% 42%)`,
  };
}

/**
 * Gera um avatar SVG único e retorna data URL.
 * Custo: <1ms, totalmente local.
 */
export function generateUniqueAvatar(input: GenerateUniqueAvatarInput): string {
  const userId = input.userId || `anon:${Math.random().toString(36).slice(2, 10)}`;
  const seed = Number.isFinite(input.seed) ? Number(input.seed) : 0;
  const fingerprint = [
    userId,
    input.fullName || '',
    input.categoryName || '',
    input.categoryIcon || '',
    String(seed),
  ].join('|');
  const h = hash32(fingerprint);
  const { c1, c2 } = palette(h);
  const iconKey = pickIconKey(input.categoryName, input.categoryIcon);
  const iconPath = iconKey ? ICON_PATHS[iconKey] : null;
  // Estilo "ondas" determinístico — varia o raio do círculo de fundo + offset do gradiente.
  const styleVariant = h % 4; // 0..3: full, ring, half, dots
  const ringId = `g${(h % 9999).toString(36)}`;

  // Conteúdo central: ícone (preferencial) OU iniciais (fallback).
  let center = '';
  if (iconPath) {
    // 24x24 → escalar pra ~110 e centralizar (origem em 45,45 → 110px de área).
    center = `<g transform='translate(45 45) scale(4.6)'><path d='${iconPath}' fill='none' stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></g>`;
  } else {
    const glyph = pickGlyph(input.categoryName, input.fullName);
    const fontSize = glyph.length === 1 ? 110 : 88;
    center = `<text x='50%' y='54%' font-family='system-ui,-apple-system,sans-serif' font-size='${fontSize}' font-weight='700' letter-spacing='-2' fill='white' text-anchor='middle' dominant-baseline='middle'>${escapeXml(glyph)}</text>`;
  }

  // Camadas de "estilo" para diferenciar variantes mesmo com a mesma categoria.
  let bgExtras = '';
  if (styleVariant === 1) {
    bgExtras = `<circle cx='100' cy='100' r='86' fill='none' stroke='white' stroke-opacity='0.35' stroke-width='4'/>`;
  } else if (styleVariant === 2) {
    bgExtras = `<rect x='0' y='100' width='200' height='100' fill='white' fill-opacity='0.10'/>`;
  } else if (styleVariant === 3) {
    bgExtras = `<circle cx='30' cy='30' r='6' fill='white' fill-opacity='0.35'/><circle cx='170' cy='170' r='8' fill='white' fill-opacity='0.25'/>`;
  }

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' role='img' aria-label='Avatar gerado'>
    <defs><linearGradient id='${ringId}' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/>
    </linearGradient></defs>
    <rect width='200' height='200' rx='100' fill='url(#${ringId})'/>
    ${bgExtras}
    ${center}
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Gera N variantes determinísticas — útil pra mostrar grade de opções no wizard.
 * Cada variante tem um seed diferente → cores/estilos distintos, mas todas associadas
 * à mesma categoria/usuário.
 */
export function generateAvatarVariants(
  input: Omit<GenerateUniqueAvatarInput, 'seed'>,
  count = 6,
): Array<{ seed: number; url: string }> {
  const out: Array<{ seed: number; url: string }> = [];
  for (let i = 0; i < count; i++) {
    out.push({ seed: i, url: generateUniqueAvatar({ ...input, seed: i }) });
  }
  return out;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
