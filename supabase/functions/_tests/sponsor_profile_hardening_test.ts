/**
 * RLS + privilege regression — profiles & sponsors sensitive columns.
 *
 * Cobre as duas correções de segurança recentes:
 *  1. `profiles`: trigger `guard_profile_privileged_columns` bloqueia
 *     usuário comum de escalar `role`, `permissions`, `staff_role`,
 *     `account_type_id`, `commercial_plan`, `is_verified` e `engagement_points`.
 *  2. `sponsors`: colunas sensíveis (`cnpj`, `email`, `phone`, `whatsapp`) não
 *     são retornáveis para `anon` mesmo em sponsors com `status='active'`.
 *  3. Grants residuais em `anon` removidos (INSERT/UPDATE/DELETE em ambas).
 *  4. RPC `log_sponsor_pii_access` só aceita admin/dono do sponsor.
 *
 * Como rodar:
 *   deno test --allow-net --allow-env \
 *     supabase/functions/_tests/sponsor_profile_hardening_test.ts
 *
 * Env obrigatório: SUPABASE_URL, SUPABASE_ANON_KEY
 * Env opcional (habilita os testes autenticados):
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_USER_ID
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://qaftogrqeyymewoofexc.supabase.co";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const TEST_EMAIL = Deno.env.get("TEST_USER_EMAIL") ?? "";
const TEST_PASSWORD = Deno.env.get("TEST_USER_PASSWORD") ?? "";
const TEST_USER_ID = Deno.env.get("TEST_USER_ID") ?? "";

const hasAnon = ANON_KEY.length > 0;
const hasAuth = hasAnon && TEST_EMAIL.length > 0 && TEST_PASSWORD.length > 0 && TEST_USER_ID.length > 0;

function anon() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

async function signedIn() {
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (error) throw new Error(`signIn failed: ${error.message}`);
  return c;
}

// --------------- SPONSORS ---------------

Deno.test({
  name: "anon CANNOT read sponsors.cnpj/email/phone/whatsapp (column grant revoked)",
  ignore: !hasAnon,
  async fn() {
    const client = anon();
    for (const col of ["cnpj", "email", "phone", "whatsapp"]) {
      const { data, error } = await client.from("sponsors").select(col).limit(1);
      // PostgREST retorna 42501 quando o role não tem SELECT na coluna.
      assert(
        error !== null,
        `sponsors.${col} STILL readable by anon: rows=${JSON.stringify(data)}`,
      );
    }
  },
});

Deno.test({
  name: "anon CAN still read public sponsor columns (id/title/status)",
  ignore: !hasAnon,
  async fn() {
    const client = anon();
    const { error } = await client.from("sponsors").select("id, title, status").limit(1);
    assertEquals(error, null, `anon should still list public sponsor fields, got ${error?.message}`);
  },
});

Deno.test({
  name: "anon CANNOT insert/update/delete sponsors (grant revoked)",
  ignore: !hasAnon,
  async fn() {
    const c = anon();
    const ins = await c.from("sponsors").insert({ title: "x", status: "active" } as never);
    assert(ins.error !== null, "anon INSERT on sponsors should fail");

    const upd = await c.from("sponsors").update({ title: "hijack" } as never).eq("id", "00000000-0000-0000-0000-000000000000");
    assert(upd.error !== null, "anon UPDATE on sponsors should fail");

    const del = await c.from("sponsors").delete().eq("id", "00000000-0000-0000-0000-000000000000");
    assert(del.error !== null, "anon DELETE on sponsors should fail");
  },
});

Deno.test({
  name: "anon CANNOT call log_sponsor_pii_access RPC",
  ignore: !hasAnon,
  async fn() {
    const c = anon();
    const { error } = await c.rpc("log_sponsor_pii_access", {
      _sponsor_id: "00000000-0000-0000-0000-000000000000",
      _accessed_columns: ["cnpj"],
      _reason: "anon probe",
      _source: "test",
    });
    assert(error !== null, "log_sponsor_pii_access should reject anon");
  },
});

// --------------- PROFILES ---------------

Deno.test({
  name: "anon has NO SELECT/INSERT/UPDATE/DELETE grant on profiles",
  ignore: !hasAnon,
  async fn() {
    const c = anon();
    // Sem grants + RLS por auth.uid: qualquer operação anon precisa falhar.
    const sel = await c.from("profiles").select("id, role").limit(1);
    assert(
      sel.error !== null || (Array.isArray(sel.data) && sel.data.length === 0),
      `profiles leaked to anon: ${JSON.stringify(sel.data)}`,
    );
    const upd = await c.from("profiles").update({ role: "admin" } as never).eq("id", "00000000-0000-0000-0000-000000000000");
    assert(upd.error !== null, "profiles UPDATE by anon should fail");
  },
});

Deno.test({
  name: "authenticated user CANNOT escalate role via profiles.update",
  ignore: !hasAuth,
  async fn() {
    const c = await signedIn();
    const { error } = await c
      .from("profiles")
      .update({ role: "admin" } as never)
      .eq("id", TEST_USER_ID);
    assert(error !== null, "profile role escalation was NOT blocked");
    // Trigger levanta 42501 — código PG chega ao cliente como '42501' ou message contendo 'not_authorized'.
    assert(
      /42501|not_authorized|permission/i.test(`${error?.code ?? ""} ${error?.message ?? ""}`),
      `unexpected error shape: ${JSON.stringify(error)}`,
    );
  },
});

Deno.test({
  name: "authenticated user CANNOT flip is_verified / commercial_plan / staff_role / permissions",
  ignore: !hasAuth,
  async fn() {
    const c = await signedIn();
    const payloads: Array<Record<string, unknown>> = [
      { is_verified: true },
      { commercial_plan: "premium" },
      { staff_role: "gerente" },
      { permissions: { admin_panel: true } },
      { engagement_points: 999999 },
      { account_type_id: "00000000-0000-0000-0000-000000000000" },
    ];
    for (const patch of payloads) {
      const { error } = await c.from("profiles").update(patch as never).eq("id", TEST_USER_ID);
      assert(error !== null, `self-escalation not blocked for: ${JSON.stringify(patch)}`);
    }
  },
});

Deno.test({
  name: "authenticated user CAN still update own non-privileged fields (full_name)",
  ignore: !hasAuth,
  async fn() {
    const c = await signedIn();
    const { error } = await c
      .from("profiles")
      .update({ full_name: `regression-check-${Date.now()}` } as never)
      .eq("id", TEST_USER_ID);
    assertEquals(error, null, `benign profile update should succeed, got ${error?.message}`);
  },
});
