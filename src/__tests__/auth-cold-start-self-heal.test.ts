/**
 * Auditoria · Fluxo "frio" (primeiro acesso)
 *
 * Cenário: usuário autenticado mas com `profile = null` (trigger lento ou
 * banco frio). O self-heal de /cadastro-inicial deve:
 *  1) detectar perfil ausente,
 *  2) inserir perfil mínimo,
 *  3) chamar `refetchProfile()` para hidratar a UI SEM novo login,
 *  4) registrar telemetria da família B_PROFILE_NULL_*.
 *
 * Observação: o código atual NÃO usa um setTimeout de 3s — o self-heal
 * é disparado imediatamente quando `loading=false && user && !profile`.
 * Este teste valida o contrato real, não o mítico "3000ms".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const trackOnboardingEvent = vi.fn().mockResolvedValue(undefined);
const refetchProfile = vi.fn().mockResolvedValue({ id: "u-1" });

// Mock do supabase client — encadeamento .from().select().eq().maybeSingle()
function makeSupabaseMock(opts: {
  selectResult: { data: any; error: any; status: number };
  insertResult: { error: any };
}) {
  const insertSpy = vi.fn().mockResolvedValue(opts.insertResult);
  const maybeSingle = vi.fn().mockResolvedValue(opts.selectResult);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, insert: insertSpy }));
  return { from, insertSpy, maybeSingle };
}

/**
 * Replica a lógica do effect de self-heal em CadastroInicialPage.
 * Mantém em sincronia com src/pages/CadastroInicialPage.tsx (linhas 206-298).
 */
async function runSelfHealEffect(deps: {
  user: { id: string; user_metadata?: any } | null;
  profile: any | null;
  loading: boolean;
  authSettled: boolean;
  supabase: any;
  alreadyAttempted: boolean;
}) {
  if (deps.loading || !deps.authSettled || !deps.user) return;
  if (deps.profile) return;

  if (deps.alreadyAttempted) {
    await trackOnboardingEvent({
      phase: "unknown",
      event: "error",
      meta: { reason: "profile_self_heal_skipped_loop_guard", error_code: "B_PROFILE_NULL_LOOP_GUARD" },
    });
    return;
  }

  const { data, error, status } = await deps.supabase
    .from("profiles")
    .select("id")
    .eq("id", deps.user.id)
    .maybeSingle();

  if (error && status === 403) {
    await trackOnboardingEvent({
      phase: "unknown",
      event: "error",
      meta: { reason: "profile_rls_403", error_code: "C_RLS_403", error_message: error.message },
    });
    return;
  }

  if (!data) {
    const meta = (deps.user.user_metadata || {}) as Record<string, any>;
    const { error: insertError } = await deps.supabase.from("profiles").insert({
      id: deps.user.id,
      full_name: meta.full_name ?? null,
      avatar_url: meta.avatar_url ?? null,
    });

    await trackOnboardingEvent({
      phase: "unknown",
      event: "error",
      meta: {
        reason: insertError ? "profile_self_heal_failed" : "profile_self_heal_ok",
        error_code: insertError ? "B_PROFILE_NULL_HEAL_FAIL" : "B_PROFILE_NULL_HEALED",
        error_message: insertError?.message ?? null,
      },
    });

    if (!insertError) {
      await refetchProfile();
    }
  } else {
    await refetchProfile();
  }
}

describe("Auditoria · self-heal em fluxo frio", () => {
  beforeEach(() => {
    trackOnboardingEvent.mockClear();
    refetchProfile.mockClear();
  });

  it("perfil ausente → INSERT + refetchProfile + telemetria B_PROFILE_NULL_HEALED", async () => {
    const { from, insertSpy } = makeSupabaseMock({
      selectResult: { data: null, error: null, status: 200 },
      insertResult: { error: null },
    });
    await runSelfHealEffect({
      user: { id: "u-1", user_metadata: { full_name: "Henrique" } },
      profile: null,
      loading: false,
      authSettled: true,
      supabase: { from },
      alreadyAttempted: false,
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u-1", full_name: "Henrique" }),
    );
    expect(refetchProfile).toHaveBeenCalledTimes(1);
    const evt = trackOnboardingEvent.mock.calls[0][0];
    expect(evt.event).toBe("error");
    expect(evt.meta.error_code).toBe("B_PROFILE_NULL_HEALED");
  });

  it("INSERT falha → telemetria B_PROFILE_NULL_HEAL_FAIL e NÃO chama refetch", async () => {
    const { from, insertSpy } = makeSupabaseMock({
      selectResult: { data: null, error: null, status: 200 },
      insertResult: { error: { message: "duplicate key" } },
    });
    await runSelfHealEffect({
      user: { id: "u-2" },
      profile: null,
      loading: false,
      authSettled: true,
      supabase: { from },
      alreadyAttempted: false,
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(refetchProfile).not.toHaveBeenCalled();
    expect(trackOnboardingEvent.mock.calls[0][0].meta.error_code).toBe("B_PROFILE_NULL_HEAL_FAIL");
  });

  it("RLS 403 ao ler profiles → telemetria C_RLS_403 sem INSERT", async () => {
    const { from, insertSpy } = makeSupabaseMock({
      selectResult: { data: null, error: { message: "permission denied" }, status: 403 },
      insertResult: { error: null },
    });
    await runSelfHealEffect({
      user: { id: "u-3" },
      profile: null,
      loading: false,
      authSettled: true,
      supabase: { from },
      alreadyAttempted: false,
    });

    expect(insertSpy).not.toHaveBeenCalled();
    expect(refetchProfile).not.toHaveBeenCalled();
    expect(trackOnboardingEvent.mock.calls[0][0].meta.error_code).toBe("C_RLS_403");
  });

  it("loop guard ativo → emite B_PROFILE_NULL_LOOP_GUARD e não toca em profiles", async () => {
    const { from, insertSpy, maybeSingle } = makeSupabaseMock({
      selectResult: { data: null, error: null, status: 200 },
      insertResult: { error: null },
    });
    await runSelfHealEffect({
      user: { id: "u-4" },
      profile: null,
      loading: false,
      authSettled: true,
      supabase: { from },
      alreadyAttempted: true,
    });

    expect(maybeSingle).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
    expect(trackOnboardingEvent.mock.calls[0][0].meta.error_code).toBe("B_PROFILE_NULL_LOOP_GUARD");
  });

  it("perfil existe no DB mas não no contexto → apenas refetch (sem telemetria de erro)", async () => {
    const { from, insertSpy } = makeSupabaseMock({
      selectResult: { data: { id: "u-5" }, error: null, status: 200 },
      insertResult: { error: null },
    });
    await runSelfHealEffect({
      user: { id: "u-5" },
      profile: null,
      loading: false,
      authSettled: true,
      supabase: { from },
      alreadyAttempted: false,
    });

    expect(insertSpy).not.toHaveBeenCalled();
    expect(refetchProfile).toHaveBeenCalledTimes(1);
    expect(trackOnboardingEvent).not.toHaveBeenCalled();
  });

  it("auth ainda carregando → effect é no-op (não dispara nada)", async () => {
    const { from, insertSpy, maybeSingle } = makeSupabaseMock({
      selectResult: { data: null, error: null, status: 200 },
      insertResult: { error: null },
    });
    await runSelfHealEffect({
      user: null,
      profile: null,
      loading: true,
      authSettled: false,
      supabase: { from },
      alreadyAttempted: false,
    });

    expect(maybeSingle).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
    expect(trackOnboardingEvent).not.toHaveBeenCalled();
    expect(refetchProfile).not.toHaveBeenCalled();
  });
});
