/**
 * sessionTouched — rastreia quais campos do wizard foram alterados pelo
 * usuário NA SESSÃO ATUAL (memória da aba).
 *
 * Usado pelo Review Step para fazer merge não-destrutivo: ao entrar
 * na tela, recarregamos o draft local SOMENTE em campos que o usuário
 * NÃO tocou, evitando sobrescrever edições feitas nesta sessão.
 *
 * Não persiste entre reloads — rastreia apenas a vida da aba.
 */

const touched = new Set<string>();

export function markFieldTouched(scope: 'profile' | 'service', field: string) {
  touched.add(`${scope}.${field}`);
}

export function markPatchTouched(scope: 'profile' | 'service', patch: Record<string, any>) {
  for (const k of Object.keys(patch)) touched.add(`${scope}.${k}`);
}

export function isFieldTouched(scope: 'profile' | 'service', field: string): boolean {
  return touched.has(`${scope}.${field}`);
}

/** Merge draft sobre estado atual, preservando campos tocados nesta sessão. */
export function mergePreservingTouched<T extends Record<string, any>>(
  scope: 'profile' | 'service',
  current: T,
  fromDraft: Partial<T> | undefined,
): T {
  if (!fromDraft) return current;
  const out: any = { ...current };
  for (const k of Object.keys(fromDraft)) {
    if (isFieldTouched(scope, k)) continue; // mantém edição da sessão
    const v = (fromDraft as any)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function clearSessionTouched() {
  touched.clear();
}
