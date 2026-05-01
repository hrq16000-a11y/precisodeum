/**
 * reviewHistory — pilha de fases visitadas pelo usuário no Wizard em modo
 * revisão (`mode=review`). Usada para que o botão "Voltar" sempre retorne à
 * fase anterior REAL (a que o usuário visitou nesta sessão), em vez de
 * depender de um mapa estático de antecessores que pode encalhar quando o
 * usuário pulou etapas com `EditModeSkipButton` ou navegou via Assistente
 * direto para uma fase específica (`?section=...`).
 *
 * Persistência: sessionStorage — sobrevive a F5 mas reseta ao fechar a aba.
 * Não vaza para outros dispositivos nem polui drafts.
 *
 * Contrato:
 *  - `pushReviewPhase(phase)`: registra que o usuário ENTROU em `phase`.
 *    Chamado a cada troca de fase quando `editMode === true`.
 *    Idempotente: se a última entrada já é `phase`, não duplica.
 *  - `popReviewPhase()`: remove e retorna a penúltima fase visitada
 *    (a "anterior"). Retorna `null` quando a pilha tem ≤1 entrada — sinal
 *    para o caller cair no fallback (voltar ao Assistente).
 *  - `clearReviewHistory()`: limpa a pilha (sair do modo revisão).
 *
 * Limite de profundidade: 32 fases — evita acúmulo patológico se um bug
 * fizer o usuário oscilar entre duas fases.
 */

const STORAGE_KEY = 'onboarding_review_history_v1';
const MAX_DEPTH = 32;

function readStack(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack.slice(-MAX_DEPTH)));
  } catch {
    /* quota cheia — fail-soft */
  }
}

export function pushReviewPhase(phase: string | null | undefined): void {
  if (!phase) return;
  const stack = readStack();
  if (stack.length > 0 && stack[stack.length - 1] === phase) return; // idempotente
  stack.push(phase);
  writeStack(stack);
}

/**
 * Remove a fase atual (topo) e retorna a anterior, se existir.
 * Retorna `null` quando não há para onde voltar (pilha esgotada) — caller
 * deve então redirecionar para o Dashboard do Assistente.
 */
export function popReviewPhase(): string | null {
  const stack = readStack();
  if (stack.length <= 1) {
    // Esgotamos o histórico — limpa para não deixar resquício.
    writeStack([]);
    return null;
  }
  stack.pop(); // remove a fase atual
  const previous = stack[stack.length - 1] ?? null;
  writeStack(stack);
  return previous;
}

export function peekReviewHistory(): string[] {
  return readStack();
}

export function clearReviewHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* fail-soft */
  }
}
