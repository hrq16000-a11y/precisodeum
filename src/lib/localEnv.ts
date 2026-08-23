/**
 * Helpers de ambiente local (Supabase rodando via Docker, sem nuvem).
 *
 * Regras:
 * - `isLocalSupabase()` — o backend em uso é o stack local do Supabase CLI.
 * - `shouldMockExternal()` — chamadas a terceiros (Resend, GSC, IndexNow)
 *   devem ser simuladas em vez de executadas.
 */

function readEnv(key: string): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[key];
}

export const SUPABASE_TARGET_URL = readEnv('VITE_SUPABASE_URL') ?? '';

export function isLocalSupabase(url: string = SUPABASE_TARGET_URL): boolean {
  return /127\.0\.0\.1|localhost|host\.docker\.internal|kong:8000/.test(url);
}

export function shouldMockExternal(): boolean {
  const explicit = readEnv('VITE_LOCAL_MOCK_EXTERNAL');
  if (explicit) return explicit.toLowerCase() === 'true';
  return isLocalSupabase();
}

/** Log simulado de sucesso para integrações externas indisponíveis offline. */
export function mockExternalCall(service: string, details: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.log(`[local-mock] ${service} — chamada externa simulada com sucesso`, details);
}

/**
 * Avisa no console qual backend está em uso — evita apontar sem querer
 * para produção durante o desenvolvimento local.
 */
export function logSupabaseTarget(): void {
  if (typeof window === 'undefined') return;
  if (!readEnv('DEV')) {
    // import.meta.env.DEV é boolean; readEnv devolve string apenas em alguns bundlers
  }
  const isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  if (!isDev) return;
  const target = SUPABASE_TARGET_URL || '(não definido)';
  const label = isLocalSupabase() ? 'LOCAL (Docker)' : 'REMOTO — cuidado, não é o ambiente local';
  // eslint-disable-next-line no-console
  console.info(`[env] Supabase: ${label} → ${target}`);
}
