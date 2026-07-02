// Testes da edge function send-email — CORS, validação Zod e cenários sucesso/erro 502.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handle } from "./index.ts";

// Stubs de env
Deno.env.set("LOVABLE_API_KEY", "test-lovable");
Deno.env.set("RESEND_API_KEY", "test-resend");
Deno.env.set("SUPABASE_URL", "");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "");

const realFetch = globalThis.fetch;

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = impl as typeof fetch;
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}

function mkReq(body: unknown, method = "POST") {
  return new Request("http://localhost/send-email", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

Deno.test("CORS: OPTIONS responde com headers permissivos", async () => {
  const res = await handle(new Request("http://localhost/send-email", { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.text();
});

Deno.test("Método não permitido responde 405", async () => {
  const res = await handle(new Request("http://localhost/send-email", { method: "GET" }));
  assertEquals(res.status, 405);
  await res.text();
});

Deno.test("Zod: html ou text obrigatórios (400)", async () => {
  const res = await handle(mkReq({ to: "a@b.com", subject: "Oi" }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(JSON.stringify(body), "Payload inválido");
});

Deno.test("Zod: to inválido (400)", async () => {
  const res = await handle(mkReq({ to: "nao-email", subject: "Oi", html: "<p>x</p>" }));
  assertEquals(res.status, 400);
  await res.text();
});

Deno.test("Sucesso: gateway responde 200 e id é retornado", async () => {
  mockFetch(async () =>
    new Response(JSON.stringify({ id: "msg_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  try {
    const res = await handle(mkReq({ to: "a@b.com", subject: "Oi", html: "<p>x</p>" }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
    assertEquals(body.id, "msg_123");
  } finally {
    restoreFetch();
  }
});

Deno.test("Falha gateway: 422 vira 502 com details", async () => {
  mockFetch(async () =>
    new Response(JSON.stringify({ message: "domain not verified" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    })
  );
  try {
    const res = await handle(mkReq({ to: "a@b.com", subject: "Oi", html: "<p>x</p>" }));
    assertEquals(res.status, 502);
    const body = await res.json();
    assertEquals(body.status, 422);
    assert(body.details);
  } finally {
    restoreFetch();
  }
});

Deno.test("Template: welcome injeta variáveis (subject e html)", async () => {
  let captured: any = null;
  mockFetch(async (_url, init) => {
    captured = JSON.parse(init!.body as string);
    return new Response(JSON.stringify({ id: "msg_w" }), { status: 200 });
  });
  try {
    const res = await handle(
      mkReq({ to: "a@b.com", template: "welcome", vars: { name: "Maria", confirmation_url: "https://precisodeum.com.br/confirm?t=abc" } }),
    );
    assertEquals(res.status, 200);
    assert(captured.subject.includes("Maria"));
    assertStringIncludes(captured.html, "Maria");
    assertStringIncludes(captured.html, "https://precisodeum.com.br/confirm?t=abc");
    // tag type=welcome
    assert((captured.tags ?? []).some((t: any) => t.name === "type" && t.value === "welcome"));
  } finally {
    restoreFetch();
  }
});

Deno.test("Template password_reset: link inválido cai no fallback do site", async () => {
  let captured: any = null;
  mockFetch(async (_u, init) => {
    captured = JSON.parse(init!.body as string);
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  });
  try {
    const res = await handle(
      mkReq({ to: "a@b.com", template: "password_reset", vars: { name: "João", reset_url: "javascript:alert(1)" } }),
    );
    assertEquals(res.status, 200);
    assertStringIncludes(captured.html, "https://precisodeum.com.br");
    assert(!captured.html.includes("javascript:"));
  } finally {
    restoreFetch();
  }
});

Deno.test("Fallback de from/reply_to quando settings indisponíveis", async () => {
  let captured: any = null;
  mockFetch(async (_u, init) => {
    captured = JSON.parse(init!.body as string);
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  });
  try {
    await handle(mkReq({ to: "a@b.com", subject: "Oi", text: "ola" }));
    assertStringIncludes(captured.from, "onboarding@resend.dev");
    assertEquals(captured.reply_to, "contato@precisodeum.com.br");
  } finally {
    restoreFetch();
  }
});
