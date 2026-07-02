/**
 * Full-name hardening (Fase 1.2).
 *
 * Objetivo: bloquear lixo óbvio em NOVOS saves de nome completo.
 * Não invalida usuários antigos — a checagem só roda quando o valor mudou
 * em relação ao anterior (helper `shouldEnforceFullName`).
 *
 * Aceita: "João Silva", "Maria de Souza", "Ana Paula", "José da Silva",
 *         "Carlos Eduardo Lima", nomes com acento, hífen e apóstrofo.
 * Rejeita: "123456", "empresa123", "teste", "a", "....",
 *          "admin", "xxxxxxxx", emails, URLs.
 */

export const FULL_NAME_INVALID_MESSAGE = 'Digite seu nome completo.';

const LETTER_RE = /[\p{L}]/u;
const ONLY_LETTERS_HYPHEN_APOST = /^[\p{L}'\-.]+$/u;
const BLOCKLIST = new Set([
  'admin',
  'administrator',
  'administrador',
  'teste',
  'tester',
  'test',
  'user',
  'usuario',
  'usuário',
  'cliente',
  'demo',
  'qwerty',
  'asdf',
  'asdfgh',
  'xxxxx',
  'aaaaa',
  'null',
  'undefined',
  'none',
  'fulano',
  'beltrano',
  'sicrano',
]);

export function normalizeFullName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

export function isValidFullName(value: unknown): boolean {
  const name = normalizeFullName(value);
  if (!name) return false;

  // Sem emails / URLs
  if (/[@]/.test(name)) return false;
  if (/(https?:\/\/|www\.)/i.test(name)) return false;

  // Letras úteis (sem espaços/pontuação) >= 4
  const lettersOnly = name.replace(/[^\p{L}]/gu, '');
  if (lettersOnly.length < 4) return false;

  // Tem que ter pelo menos uma letra (não pode ser só números/símbolos)
  if (!LETTER_RE.test(name)) return false;

  // Pelo menos 2 palavras, ambas com letra
  const parts = name.split(' ').filter(Boolean);
  if (parts.length < 2) return false;
  const wordsWithLetter = parts.filter((p) => LETTER_RE.test(p));
  if (wordsWithLetter.length < 2) return false;

  // Cada palavra só pode conter letras, hífen, apóstrofo ou ponto (Jr.)
  for (const p of parts) {
    if (!ONLY_LETTERS_HYPHEN_APOST.test(p)) return false;
  }

  // Pelo menos uma palavra com 2+ letras (evita "A B")
  if (!wordsWithLetter.some((p) => p.replace(/[^\p{L}]/gu, '').length >= 2)) return false;

  // Bloqueia repetição extrema do mesmo caractere (xxxxxx, aaaaaa)
  if (/(\p{L})\1{4,}/u.test(name.toLowerCase())) return false;

  // Pontuação excessiva (> 25% do total)
  const punctCount = (name.match(/[.\-']/g) || []).length;
  if (punctCount > Math.floor(name.replace(/\s/g, '').length * 0.25)) return false;

  // Blocklist de tokens óbvios — bloqueia se TODAS as palavras estão na lista
  const lowered = parts.map((p) => p.toLowerCase().replace(/[^\p{L}]/gu, ''));
  if (lowered.every((p) => BLOCKLIST.has(p))) return false;

  return true;
}

/**
 * Decide se a validação deve ser aplicada neste save.
 * Regra: só valida quando o nome mudou em relação ao previous (legado preservado).
 */
export function shouldEnforceFullName(next: unknown, previous: unknown): boolean {
  const a = normalizeFullName(next);
  const b = normalizeFullName(previous);
  return a !== b;
}
