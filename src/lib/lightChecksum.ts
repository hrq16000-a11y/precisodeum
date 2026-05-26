/**
 * Checksum leve (FNV-1a 32-bit) — síncrono, sem dependências, sem WebCrypto.
 *
 * Uso: validar integridade de payloads pequenos em localStorage (drafts do
 * onboarding). NÃO é seguro contra adversários, apenas detecta corrupção
 * acidental (quota cheia, truncamento, edição manual).
 */

export function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619, sem perder precisão em 32-bit
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Calcula checksum estável de um objeto serializável.
 * Ordena chaves no topo para resistir a reordenações triviais.
 */
export function stableChecksum(obj: unknown): string {
  try {
    if (obj === null || typeof obj !== 'object') return fnv1a32(String(obj));
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const ordered: Record<string, unknown> = {};
    for (const k of keys) ordered[k] = (obj as any)[k];
    return fnv1a32(JSON.stringify(ordered));
  } catch {
    return '00000000';
  }
}
