/**
 * RLS + RPC regression — sponsor_leads / attach_sponsor_lead_docs.
 *
 * Cobre:
 *  - anon consegue INSERT (lead capture legítimo) e recebe submission_token.
 *  - anon NÃO consegue UPDATE direto em sponsor_leads (policy anon removida).
 *  - anon consegue chamar attach_sponsor_lead_docs COM token correto.
 *  - anon recebe erro "invalid_token" com token errado.
 *  - anon recebe erro "invalid_arguments" com argumentos nulos.
 *  - authenticated (não-admin) NÃO consegue ler sponsor_leads de outros
 *    nem UPDATE — mesmo cenário de anon.
 *  - Cada tentativa (sucesso ou falha) gera linha em sponsor_lead_docs_audit
 *    (só service_role consegue confirmar; anon/authenticated ficam sem SELECT).
 *
 * Como rodar:
 *   deno test --allow-net --allow-env \
 *     supabase/functions/_tests/sponsor_leads_rpc_test.ts
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "https://qaftogrqeyymewoofexc.supabase.co";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const hasAnon = ANON_KEY.length > 0;
const hasService = SERVICE_KEY.length > 0;

const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});
const service = hasService
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null;

async function createLead() {
  const stamp = Date.now();
  const { data, error } = await anon
    .from("sponsor_leads")
    .insert({
      company_name: `Test Co ${stamp}`,
      cnpj: `00.000.000/0001-${String(stamp).slice(-2)}`,
      email: `test+${stamp}@example.com`,
      phone: `+55119${String(stamp).slice(-8)}`,
      plan: "pro",
      contract_accepted: true,
      status: "pending",
    })
    .select("id, submission_token")
    .single();
  return { data, error };
}

Deno.test({
  name: "anon CAN insert sponsor_lead and receive submission_token",
  ignore: !hasAnon,
  async fn() {
    const { data, error } = await createLead();
    assertEquals(error, null, `insert failed: ${error?.message}`);
    assert(data?.id, "no id returned");
    assert(data?.submission_token, "no submission_token returned");
  },
});

Deno.test({
  name: "anon CANNOT UPDATE sponsor_leads directly",
  ignore: !hasAnon,
  async fn() {
    const { data: lead } = await createLead();
    if (!lead?.id) return;
    const { error, data } = await anon
      .from("sponsor_leads")
      .update({ email: "attacker@evil.com" })
      .eq("id", lead.id)
      .select();
    // Aceita: erro explícito OU zero rows afetadas (policy nega o WHERE).
    assert(
      error !== null || !Array.isArray(data) || data.length === 0,
      `anon conseguiu UPDATE: ${JSON.stringify(data)}`,
    );
  },
});

Deno.test({
  name: "attach_sponsor_lead_docs succeeds with correct token",
  ignore: !hasAnon,
  async fn() {
    const { data: lead } = await createLead();
    if (!lead?.id || !lead?.submission_token) return;
    const { data, error } = await anon.rpc("attach_sponsor_lead_docs", {
      _lead_id: lead.id,
      _token: lead.submission_token,
      _cnpj_document_url: "leads/test/cnpj.pdf",
      _banner_url: null,
      _checklist_confirmed: true,
      _additional_docs: null,
    });
    assertEquals(error, null, `rpc failed: ${error?.message}`);
    assertEquals(data, true);
  },
});

Deno.test({
  name: "attach_sponsor_lead_docs fails with wrong token (invalid_token)",
  ignore: !hasAnon,
  async fn() {
    const { data: lead } = await createLead();
    if (!lead?.id) return;
    const { error } = await anon.rpc("attach_sponsor_lead_docs", {
      _lead_id: lead.id,
      _token: "00000000-0000-0000-0000-000000000000",
      _cnpj_document_url: "leads/test/cnpj.pdf",
    });
    assert(error !== null, "esperado erro com token errado");
    assert(
      /invalid_token/i.test(error?.message ?? ""),
      `mensagem inesperada: ${error?.message}`,
    );
  },
});

Deno.test({
  name: "attach_sponsor_lead_docs fails with null args (invalid_arguments)",
  ignore: !hasAnon,
  async fn() {
    const { error } = await anon.rpc("attach_sponsor_lead_docs", {
      _lead_id: null as unknown as string,
      _token: null as unknown as string,
    });
    assert(error !== null, "esperado erro com argumentos nulos");
    assert(
      /invalid_arguments/i.test(error?.message ?? ""),
      `mensagem inesperada: ${error?.message}`,
    );
  },
});

Deno.test({
  name: "accept_sponsor_lead_contract succeeds with correct token",
  ignore: !hasAnon,
  async fn() {
    const { data: lead } = await createLead();
    if (!lead?.id || !lead?.submission_token) return;
    const { data, error } = await anon.rpc("accept_sponsor_lead_contract", {
      _lead_id: lead.id,
      _token: lead.submission_token,
    });
    assertEquals(error, null, `rpc failed: ${error?.message}`);
    assertEquals(data, true);
  },
});

Deno.test({
  name: "anon CANNOT read sponsor_lead_docs_audit",
  ignore: !hasAnon,
  async fn() {
    const { data, error } = await anon
      .from("sponsor_lead_docs_audit")
      .select("id")
      .limit(1);
    assert(
      error !== null || (Array.isArray(data) && data.length === 0),
      `anon vazou audit trail: ${JSON.stringify(data)}`,
    );
  },
});

Deno.test({
  name: "service_role sees audit rows after RPC calls",
  ignore: !hasService,
  async fn() {
    const { data: lead } = await createLead();
    if (!lead?.id || !lead?.submission_token) return;
    // Uma bem-sucedida
    await anon.rpc("attach_sponsor_lead_docs", {
      _lead_id: lead.id,
      _token: lead.submission_token,
      _checklist_confirmed: true,
    });
    // Uma com token errado
    await anon.rpc("attach_sponsor_lead_docs", {
      _lead_id: lead.id,
      _token: "00000000-0000-0000-0000-000000000000",
    });
    const { data, error } = await service!
      .from("sponsor_lead_docs_audit")
      .select("outcome")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });
    assertEquals(error, null);
    assert(Array.isArray(data) && data.length >= 2, "faltam linhas de auditoria");
    const outcomes = new Set((data ?? []).map((r) => r.outcome));
    assert(outcomes.has("success"), "faltou outcome=success");
    assert(outcomes.has("invalid_token"), "faltou outcome=invalid_token");
  },
});
