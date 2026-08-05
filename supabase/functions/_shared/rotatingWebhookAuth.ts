/**
 * rotatingWebhookAuth — validação de webhooks com assinatura HMAC-SHA256,
 * janela de timestamp (anti-replay) e ROTAÇÃO de segredo por versão.
 *
 * Contrato de headers esperado do emissor:
 *   x-webhook-timestamp: <unix seconds>
 *   x-webhook-signature: v1=<hex>            (uma ou mais, separadas por espaço/vírgula)
 *
 * Assinatura = HMAC_SHA256(secret, `${timestamp}.${rawBody}`) em hex.
 *
 * Rotação: o validador aceita QUALQUER segredo ativo, na ordem:
 *   1. `${prefix}`             → segredo atual (v1)
 *   2. `${prefix}_PREVIOUS`    → segredo anterior (janela de rotação)
 *   3. `${prefix}_NEXT`        → próximo segredo (pré-provisionamento)
 * Isso permite trocar o segredo no emissor e no projeto em momentos
 * diferentes, sem downtime nem alerta perdido.
 *
 * Fail-closed: sem nenhum segredo configurado → não autoriza por assinatura.
 */

export type WebhookAuthResult =
  | { ok: true; via: "signature"; keyVersion: string }
  | { ok: true; via: "service_role"; keyVersion: "service_role" }
  | { ok: false; status: number; error: string };

const MAX_SKEW_SECONDS = 300; // ±5 min

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Lê os segredos ativos (atual, anterior, próximo) sem expor valores. */
export function loadRotatingSecrets(prefix: string): Array<{ version: string; secret: string }> {
  const out: Array<{ version: string; secret: string }> = [];
  const current = Deno.env.get(prefix);
  const previous = Deno.env.get(`${prefix}_PREVIOUS`);
  const next = Deno.env.get(`${prefix}_NEXT`);
  if (current) out.push({ version: "current", secret: current });
  if (previous) out.push({ version: "previous", secret: previous });
  if (next) out.push({ version: "next", secret: next });
  return out;
}

/**
 * Valida a chamada. `rawBody` deve ser o corpo lido UMA vez pelo caller.
 * `allowServiceRole` mantém compatibilidade com Database Webhooks do Supabase,
 * que autenticam via Bearer service role key.
 */
export async function verifyRotatingWebhook(
  req: Request,
  rawBody: string,
  opts: { prefix: string; allowServiceRole?: boolean },
): Promise<WebhookAuthResult> {
  const secrets = loadRotatingSecrets(opts.prefix);
  const timestamp = req.headers.get("x-webhook-timestamp");
  const signatureHeader = req.headers.get("x-webhook-signature");

  // Caminho A — assinatura HMAC (preferencial).
  if (signatureHeader || timestamp) {
    if (!timestamp || !signatureHeader) {
      return { ok: false, status: 401, error: "missing_signature_or_timestamp" };
    }
    const ts = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(ts)) {
      return { ok: false, status: 401, error: "invalid_timestamp" };
    }
    if (Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) {
      return { ok: false, status: 401, error: "timestamp_out_of_window" };
    }
    if (secrets.length === 0) {
      return { ok: false, status: 500, error: "secret_not_configured" };
    }
    const provided = signatureHeader
      .split(/[\s,]+/)
      .map((part) => (part.includes("=") ? part.split("=")[1] : part))
      .filter(Boolean)
      .map((s) => s.toLowerCase());

    const payload = `${ts}.${rawBody}`;
    for (const { version, secret } of secrets) {
      const expected = await hmacHex(secret, payload);
      if (provided.some((p) => timingSafeEqual(p, expected))) {
        return { ok: true, via: "signature", keyVersion: version };
      }
    }
    return { ok: false, status: 401, error: "invalid_signature" };
  }

  // Caminho B — Database Webhook interno com service role key.
  if (opts.allowServiceRole) {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (serviceKey && bearer && timingSafeEqual(bearer, serviceKey)) {
      return { ok: true, via: "service_role", keyVersion: "service_role" };
    }
  }

  return { ok: false, status: 401, error: "unauthorized" };
}
