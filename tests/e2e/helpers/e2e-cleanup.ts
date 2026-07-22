/**
 * Helpers compartilhados para testes E2E do fluxo de signup.
 *
 * - `uniqueE2eEmail()` gera e-mail no padrão `e2e+<ts>-<rand>@precisodeum.test`
 *   que o edge function `cleanup-e2e-test-users` reconhece por regex.
 * - `strongPassword()` retorna senha compatível com o HIBP-gated do projeto.
 * - `registerE2eEmail()`/`cleanupRegisteredEmails()` acumulam e-mails criados
 *   durante o teste para purge determinístico no `afterAll`.
 * - `cleanupE2eUsers()` invoca o edge function via `x-cron-secret` (quando
 *   presente) para remover auth users + storage. Falha graciosamente se as
 *   credenciais não estiverem disponíveis — o cron nightly (`security-nightly`)
 *   também roda o mesmo edge function como rede de segurança.
 */

const CREATED: Set<string> = new Set();

export function uniqueE2eEmail(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e+${ts}-${rand}@precisodeum.test`;
}

export function strongPassword(): string {
  return `E2eTest!${Date.now().toString(36)}Aa1`;
}

export function registerE2eEmail(email: string) {
  if (email) CREATED.add(email.toLowerCase());
}

export function drainRegisteredEmails(): string[] {
  const list = Array.from(CREATED);
  CREATED.clear();
  return list;
}

export interface CleanupResult {
  invoked: boolean;
  status?: number;
  body?: unknown;
  skippedReason?: string;
}

export async function cleanupE2eUsers(opts?: {
  emails?: string[];
  supabaseUrl?: string;
  cronSecret?: string;
}): Promise<CleanupResult> {
  const supabaseUrl = opts?.supabaseUrl ?? process.env.SUPABASE_URL ?? '';
  const cronSecret = opts?.cronSecret ?? process.env.CRON_SECRET ?? '';
  if (!supabaseUrl || !cronSecret) {
    return { invoked: false, skippedReason: 'missing SUPABASE_URL or CRON_SECRET' };
  }
  const emails = opts?.emails ?? drainRegisteredEmails();
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/cleanup-e2e-test-users`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cron-secret': cronSecret },
      body: JSON.stringify({ emails }),
    });
    const body = await resp.json().catch(() => ({}));
    return { invoked: true, status: resp.status, body };
  } catch (err) {
    return { invoked: false, skippedReason: (err as Error).message };
  }
}
