/**
 * RLS Regression Tests — Supabase
 *
 * Verifica que clientes anon/authenticated NÃO conseguem acessar
 * colunas/tabelas/funções que devem ser protegidas.
 *
 * Como rodar:
 *   deno test --allow-net --allow-env supabase/functions/_tests/rls_regression_test.ts
 *
 * Requer env: SUPABASE_URL, SUPABASE_ANON_KEY (e opcionalmente SUPABASE_SERVICE_ROLE_KEY).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://qaftogrqeyymewoofexc.supabase.co";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

if (!ANON_KEY) {
  console.warn("[rls_regression] SUPABASE_ANON_KEY not set; tests will be skipped");
}

const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

Deno.test({
  name: "anon CANNOT read providers.cpf",
  ignore: !ANON_KEY,
  async fn() {
    const { data, error } = await anon.from("providers").select("cpf").limit(1);
    // Either column-level grant denies (data null + error) OR returns no rows for masked column
    assert(error !== null || (Array.isArray(data) && data.every(r => !("cpf" in r) || r.cpf === null)),
      `providers.cpf leaked to anon: ${JSON.stringify(data)}`);
  },
});

Deno.test({
  name: "anon CANNOT read providers.cnpj or birth_date",
  ignore: !ANON_KEY,
  async fn() {
    const { error } = await anon.from("providers").select("cnpj, birth_date").limit(1);
    assert(error !== null, `providers.cnpj/birth_date leaked to anon`);
  },
});

Deno.test({
  name: "anon CANNOT UPDATE sponsor_leads (overbroad block)",
  ignore: !ANON_KEY,
  async fn() {
    const { error } = await anon
      .from("sponsor_leads")
      .update({ email: "attacker@evil.com" })
      .eq("id", "00000000-0000-0000-0000-000000000000");
    assert(error !== null, "anon was able to UPDATE sponsor_leads.email");
  },
});

Deno.test({
  name: "anon CANNOT INSERT into system_audit_logs",
  ignore: !ANON_KEY,
  async fn() {
    const { error } = await anon.from("system_audit_logs").insert({
      action: "test_attack", staff_id: "00000000-0000-0000-0000-000000000000",
    });
    assert(error !== null, "anon was able to INSERT system_audit_logs");
  },
});

Deno.test({
  name: "anon CANNOT EXECUTE admin_* RPCs",
  ignore: !ANON_KEY,
  async fn() {
    const candidates = [
      "admin_list_orphan_profiles",
      "admin_onboarding_stats",
      "admin_capture_rls_snapshot",
      "capture_rls_drift",
    ];
    for (const fn of candidates) {
      const { error } = await anon.rpc(fn as never, {} as never);
      assert(error !== null, `anon was able to call public.${fn}()`);
    }
  },
});

Deno.test({
  name: "anon CANNOT read rls_drift_alerts",
  ignore: !ANON_KEY,
  async fn() {
    const { data, error } = await anon.from("rls_drift_alerts").select("id").limit(1);
    assert(error !== null || (Array.isArray(data) && data.length === 0),
      "anon was able to read rls_drift_alerts");
  },
});

Deno.test({
  name: "anon CAN read providers public columns (smoke test — must not break)",
  ignore: !ANON_KEY,
  async fn() {
    const { error } = await anon.from("providers").select("id, business_name, city, slug").limit(1);
    assertEquals(error, null, `public providers columns broke for anon: ${error?.message}`);
  },
});
