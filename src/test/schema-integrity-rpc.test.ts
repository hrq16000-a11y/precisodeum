import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Schema & onboarding RPC integrity tests.
 *
 * These tests run against the live Lovable Cloud backend and validate that the
 * critical pieces used by the registration → wizard → dashboard flow remain
 * present after every migration:
 *
 *   - critical RPCs are reachable
 *   - critical columns exist (audit_log, media, profiles, providers)
 *   - validate_db_health returns ok=true
 *
 * They are intentionally lightweight (only metadata / schema checks) so they
 * can be added to CI without requiring authenticated test users.
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "") as string;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "") as string;

const hasEnv = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
const describeIfEnv = hasEnv ? describe : describe.skip;

describeIfEnv("schema integrity (post-migration safety net)", () => {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  beforeAll(() => {
    if (!hasEnv) {
      console.warn("Skipping schema-integrity tests: SUPABASE env not set");
    }
  });

  it("validate_db_health RPC exists and returns ok", async () => {
    const { data, error } = await client.rpc("validate_db_health" as never);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    const r = data as unknown as { ok: boolean; rpcs: unknown[]; columns: unknown[] };
    expect(Array.isArray(r.rpcs)).toBe(true);
    expect(Array.isArray(r.columns)).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("audit_log has required columns", async () => {
    const { data, error } = await client.rpc("validate_db_health" as never);
    expect(error).toBeNull();
    const r = data as unknown as { columns: { table: string; column: string; ok: boolean }[] };
    const required = ["resource_type", "resource_id", "details", "action", "user_id"];
    for (const col of required) {
      const found = r.columns.find((c) => c.table === "audit_log" && c.column === col);
      expect(found, `audit_log.${col} must exist`).toBeTruthy();
      expect(found?.ok, `audit_log.${col} must be ok`).toBe(true);
    }
  });

  it("media table uses user_ref (not owner_id)", async () => {
    const { data, error } = await client.rpc("validate_db_health" as never);
    expect(error).toBeNull();
    const r = data as unknown as { columns: { table: string; column: string; ok: boolean }[] };
    const ref = r.columns.find((c) => c.table === "media" && c.column === "user_ref");
    expect(ref?.ok, "media.user_ref must exist").toBe(true);
  });

  it("onboarding RPCs (register_service_completion, audit_user_ref_health) are present", async () => {
    const { data, error } = await client.rpc("validate_db_health" as never);
    expect(error).toBeNull();
    const r = data as unknown as { rpcs: { name: string; ok: boolean }[] };
    const required = ["register_service_completion", "audit_user_ref_health", "has_role", "nearby_providers"];
    for (const fn of required) {
      const f = r.rpcs.find((x) => x.name === fn);
      expect(f, `RPC ${fn} must exist`).toBeTruthy();
      expect(f?.ok, `RPC ${fn} must be ok`).toBe(true);
    }
  });

  it("providers table is reachable (basic smoke test)", async () => {
    // Just ensures RLS allows anon read of at least the schema (count head)
    const { error } = await client.from("providers").select("id", { count: "exact", head: true });
    // Either succeeds (public approved providers visible) or returns explicit RLS error,
    // but should NOT throw a "relation does not exist" type failure.
    if (error) {
      expect(error.message).not.toMatch(/does not exist|undefined column/i);
    }
  });
});
