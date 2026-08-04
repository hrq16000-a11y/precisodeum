/**
 * Versão atual do app — bumpada manualmente a cada release.
 * Comparada contra `app_min_version` e `app_latest_version` em `site_settings`
 * via RPC `get_app_version_config` para forçar/sugerir atualizações sem novo
 * deploy do código (Remote Config "estilo Mercado Livre").
 */
export const APP_VERSION = '1.2.2';

/**
 * Identificador único do build atual — injetado pelo Vite via
 * `__BUILD_TIMESTAMP__` (ver `vite.config.ts`). Muda a cada deploy mesmo
 * quando `APP_VERSION` permanece igual, o que permite correlacionar
 * erros/telemetria a deploys específicos.
 */
export const APP_BUILD_ID: string = (() => {
  try {
    return String((globalThis as any).__BUILD_TIMESTAMP__ ?? 'unknown');
  } catch {
    return 'unknown';
  }
})();

/**
 * Compara duas versões semver-like (`major.minor.patch`).
 * - Retorna -1 se a < b, 0 se igual, 1 se a > b.
 * - Tolera valores ausentes/inválidos retornando 0.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    String(v || '0.0.0')
      .split('.')
      .map((n) => Math.max(0, parseInt(n, 10) || 0));
  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const x = av[i] ?? 0;
    const y = bv[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}
