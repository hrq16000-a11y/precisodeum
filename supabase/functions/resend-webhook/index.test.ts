// Testes do parsing/normalização do payload do Resend → email_events.
// Não chama supabase real: testa a forma do registro derivado do evento.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function deriveEvent(evt: any) {
  const type: string = evt?.type ?? "unknown";
  const data = evt?.data ?? {};
  const messageId = data.email_id ?? data.id ?? null;
  const recipient = Array.isArray(data.to) ? data.to[0] : data.to ?? null;
  const subject = data.subject ?? null;
  const tags: Array<{ name: string; value: string }> = data.tags ?? [];
  const template = tags.find((t) => t.name === "type")?.value ?? null;
  return {
    provider: "resend",
    message_id: messageId,
    event_type: type,
    recipient,
    subject,
    template,
    occurred_at: data.created_at ? new Date(data.created_at).toISOString() : null,
  };
}

Deno.test("delivered: mapeia message_id, recipient e template via tags", () => {
  const evt = {
    type: "email.delivered",
    data: {
      email_id: "msg_abc",
      to: ["alice@ex.com"],
      subject: "Bem-vinda",
      tags: [{ name: "type", value: "welcome" }],
      created_at: "2026-04-29T10:00:00Z",
    },
  };
  const out = deriveEvent(evt);
  assertEquals(out.event_type, "email.delivered");
  assertEquals(out.message_id, "msg_abc");
  assertEquals(out.recipient, "alice@ex.com");
  assertEquals(out.template, "welcome");
  assertEquals(out.occurred_at, "2026-04-29T10:00:00.000Z");
});

Deno.test("bounced: aceita 'to' como string e sem tags", () => {
  const evt = { type: "email.bounced", data: { id: "msg_b", to: "x@y.com", subject: "z" } };
  const out = deriveEvent(evt);
  assertEquals(out.event_type, "email.bounced");
  assertEquals(out.recipient, "x@y.com");
  assertEquals(out.template, null);
  assertEquals(out.message_id, "msg_b");
});

Deno.test("evento desconhecido vira type=unknown", () => {
  const out = deriveEvent({});
  assertEquals(out.event_type, "unknown");
  assertEquals(out.message_id, null);
});
