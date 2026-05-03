/**
 * Valida a assinatura HMAC-SHA256 de webhooks do Resend.
 * O Resend usa o padrão Svix: headers svix-id, svix-timestamp, svix-signature.
 *
 * Referência: https://resend.com/docs/dashboard/webhooks/introduction
 *
 * Comportamento (fail-closed):
 * - Sem RESEND_WEBHOOK_SECRET configurado → 500 not_configured.
 * - Headers svix-* ausentes → 401 missing_signature.
 * - Timestamp fora da janela ±5 min → 401 timestamp_invalid (anti-replay).
 * - Assinatura inválida → 401 invalid_signature.
 * - Match exato → retorna null (autorizado).
 *
 * IMPORTANTE: o caller deve ler `req.text()` UMA vez e passar `rawBody`,
 * pois Request body é stream consumível só uma vez.
 */
export async function validateResendWebhook(
  req: Request,
  rawBody: string,
): Promise<Response | null> {
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[webhookAuth] RESEND_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[webhookAuth] missing svix headers");
    return new Response(JSON.stringify({ error: "missing_signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Anti-replay: rejeita eventos com timestamp fora da janela ±5 min.
  const ts = parseInt(svixTimestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    console.warn("[webhookAuth] webhook timestamp too old or too far in future");
    return new Response(JSON.stringify({ error: "timestamp_invalid" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Spec Svix: signed payload = `${id}.${timestamp}.${rawBody}`
    const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;

    // Secret vem em base64 (com prefixo opcional "whsec_")
    const secretBytes = Uint8Array.from(
      atob(secret.replace(/^whsec_/, "")),
      (c) => c.charCodeAt(0),
    );

    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload),
    );

    const computedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signatureBytes)),
    );

    // svix-signature pode conter múltiplas assinaturas, formato "v1,<sig> v1,<sig2>"
    const provided = svixSignature
      .split(" ")
      .map((s) => s.split(",")[1])
      .filter(Boolean);

    const valid = provided.includes(computedSignature);

    if (!valid) {
      console.warn("[webhookAuth] invalid webhook signature");
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return null;
  } catch (err) {
    console.error("[webhookAuth] verification error", err);
    return new Response(JSON.stringify({ error: "verification_failed" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}
