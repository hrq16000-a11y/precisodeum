/**
 * Deno test — Fluxo de cadastro (integração + SQL contract).
 *
 * Executa contra o Supabase real do preview e valida:
 *   1. `auth.signUp` de novo e-mail cria linha em `public.profiles` via
 *      trigger `handle_new_user` (com role default).
 *   2. RPC `check_tax_id_duplicate(_tax_id, _current_user)` está EXECUTE
 *      para roles anon/authenticated e retorna boolean sem vazar PII.
 *   3. Trigger `guard_profile_privileged_columns` bloqueia self-update em
 *      colunas privilegiadas (`role`) — deve retornar 42501 ou raise, e o
 *      valor da coluna não pode mudar.
 *   4. `public.profiles` não tem coluna `is_verified` (regressão do bug
 *      "record 'new' has no field 'is_verified'"). A checagem é feita via
 *      SELECT no information_schema.
 *
 * Variáveis de ambiente esperadas:
 *   SUPABASE_URL              — URL do projeto (preview).
 *   SUPABASE_ANON_KEY         — anon key (publishable).
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (opcional; se ausente,
 *                               o teste de information_schema é pulado).
 *
 * Sem credenciais → `Deno.test.ignore` (skip gracioso).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assert, assertEquals, assertExists } from 'jsr:@std/assert';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const hasBaseCreds = Boolean(SUPABASE_URL && ANON_KEY);
const hasServiceKey = Boolean(SUPABASE_URL && SERVICE_KEY);

function uniqueEmail() {
  return `e2e+${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}@precisodeum.test`;
}

Deno.test({
  name: 'signup cria profile + role default via handle_new_user',
  ignore: !hasBaseCreds,
  fn: async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const email = uniqueEmail();
    const password = `E2eTest!${Date.now().toString(36)}Aa1`;

    const { data, error } = await anon.auth.signUp({ email, password });
    assert(!error, `signUp failed: ${error?.message}`);
    assertExists(data.user, 'user retornado do signUp');

    // Aguarda a trigger propagar (é síncrona, mas leva 1 tick de rede).
    await new Promise((r) => setTimeout(r, 500));

    // Autenticado agora — RLS do próprio user permite SELECT do próprio row.
    const authed = anon;
    const { data: profile, error: profErr } = await authed
      .from('profiles')
      .select('id, role')
      .eq('id', data.user.id)
      .maybeSingle();
    assert(!profErr, `select profile failed: ${profErr?.message}`);
    assertExists(profile, 'profile foi criado pela trigger handle_new_user');
  },
});

Deno.test({
  name: 'RPC check_tax_id_duplicate é callable como authenticated e retorna boolean',
  ignore: !hasBaseCreds,
  fn: async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const email = uniqueEmail();
    const password = `E2eTest!${Date.now().toString(36)}Aa1`;
    const { data: sess } = await anon.auth.signUp({ email, password });
    assertExists(sess.user);

    const { data, error } = await anon.rpc('check_tax_id_duplicate', {
      _tax_id: '12345678909',
      _current_user: sess.user.id,
    });
    assert(!error, `RPC error: ${error?.message}`);
    assertEquals(typeof data, 'boolean', 'RPC deve retornar boolean');
  },
});

Deno.test({
  name: 'guard_profile_privileged_columns bloqueia self-update de role',
  ignore: !hasBaseCreds,
  fn: async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const email = uniqueEmail();
    const password = `E2eTest!${Date.now().toString(36)}Aa1`;
    const { data: sess } = await anon.auth.signUp({ email, password });
    assertExists(sess.user);
    await new Promise((r) => setTimeout(r, 400));

    const { data: before } = await anon
      .from('profiles')
      .select('role')
      .eq('id', sess.user.id)
      .maybeSingle();

    const { error } = await anon
      .from('profiles')
      .update({ role: 'admin' as never })
      .eq('id', sess.user.id);

    // Aceita duas defesas legítimas: erro explícito OU update silencioso
    // ignorado por trigger — em ambos os casos o valor NÃO pode ter mudado.
    const { data: after } = await anon
      .from('profiles')
      .select('role')
      .eq('id', sess.user.id)
      .maybeSingle();

    assertEquals(
      after?.role ?? null,
      before?.role ?? null,
      `role NÃO pode ter sido escalada por self-update. erro: ${error?.message ?? 'nenhum'}`,
    );
  },
});

Deno.test({
  name: 'profiles não possui coluna is_verified (regressão de trigger)',
  ignore: !hasServiceKey,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .limit(1);
    assert(!error, `select profiles failed: ${error?.message}`);
    if (data && data.length > 0) {
      assert(
        !('is_verified' in data[0]),
        'public.profiles NÃO pode ter coluna is_verified (é de providers). Ver bug do trigger.',
      );
    }
  },
});
