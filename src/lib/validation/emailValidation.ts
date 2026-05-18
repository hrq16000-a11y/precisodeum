/**
 * Hardening leve de validação de email (Fase 1.1).
 *
 * Objetivo: bloquear erros óbvios e typos comuns sem virar RFC 5322 completo.
 * NÃO faz lookup de MX/DNS, NÃO bloqueia disposable e NÃO altera auth.
 *
 * Regras:
 *  - trim + lowercase
 *  - exatamente um "@"
 *  - sem espaços
 *  - local-part 1..64, sem ".." e sem começar/terminar com "."
 *  - domínio com ao menos um ponto
 *  - labels de domínio 1..63 ([a-z0-9-], sem começar/terminar com "-")
 *  - TLD final apenas letras, 2..6 chars (bloqueia .c, .comc, .comm, etc.)
 *  - tamanho total <= 254
 */

const TLD_RE = /^[a-z]{2,6}$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const LOCAL_RE = /^[a-z0-9._%+\-]+$/;

export function normalizeEmail(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  if (!email || email.length > 254) return false;
  if (/\s/.test(email)) return false;

  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (!local || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!LOCAL_RE.test(local)) return false;

  if (!domain || domain.length > 253) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!LABEL_RE.test(label)) return false;
  }

  const tld = labels[labels.length - 1];
  if (!TLD_RE.test(tld)) return false;

  return true;
}

export const EMAIL_INVALID_MESSAGE = 'Digite um e-mail válido.';
