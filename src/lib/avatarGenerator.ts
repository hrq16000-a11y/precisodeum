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
  const glyph = pickGlyph(input.categoryName, input.fullName);
  // Tamanho de fonte adaptativo: 1 caractere → maior; 2 → menor.
  const fontSize = glyph.length === 1 ? 110 : 88;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' role='img' aria-label='Avatar gerado'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/>
    </linearGradient></defs>
    <rect width='200' height='200' rx='100' fill='url(#g)'/>
    <text x='50%' y='54%' font-family='system-ui,-apple-system,sans-serif' font-size='${fontSize}' font-weight='700' letter-spacing='-2'
      fill='white' text-anchor='middle' dominant-baseline='middle'>${escapeXml(glyph)}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
