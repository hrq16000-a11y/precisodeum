/**
 * Detecção de ambiente local (supabase start / docker) para Edge Functions.
 *
 * Quando o projeto roda 100% offline não existe internet nem credenciais reais
 * de terceiros (Resend, Google Search Console, IndexNow/Bing). Em vez de
 * travar a função com timeout de rede, as chamadas externas são "mockadas":
 * apenas registram um console.log de sucesso simulado.
 *
 * Como forçar: defina `LOCAL_MOCK_EXTERNAL=true` (ou `false` para desligar).
 */
export function isLocalEnv(): boolean {
  const explicit = Deno.env.get("LOCAL_MOCK_EXTERNAL");
  if (explicit != null && explicit !== "") return explicit.toLowerCase() === "true";

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  return (
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.includes("kong:8000") ||
    url.includes("host.docker.internal")
  );
}

/** Log padronizado de chamada externa simulada. */
export function mockExternalCall(service: string, details: Record<string, unknown> = {}) {
  console.log(
    `[local-mock] ${service} — chamada externa simulada com sucesso`,
    JSON.stringify(details).slice(0, 500),
  );
}
