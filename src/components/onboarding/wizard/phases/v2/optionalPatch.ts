/**
 * Converte strings vazias / undefined em `null` para respeitar o contrato
 * do Postgres (campos opcionais devem armazenar NULL, não '').
 *
 * Uso típico nos onContinue/onSkip das fases 4 (Bio, Bairro, Redes).
 */
export function nullifyEmpty<T extends Record<string, any>>(patch: T): T {
  const out: Record<string, any> = {};
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (v === '' || v === undefined) out[k] = null;
    else if (typeof v === 'string') out[k] = v.trim() === '' ? null : v.trim();
    else out[k] = v;
  }
  return out as T;
}
