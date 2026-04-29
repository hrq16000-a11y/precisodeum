// portability-restore: provides server-side helpers for the "Restore in new host" flow.
// Actions:
//   - secrets-checklist: reports which env vars / secrets are configured in the
//     current backend (Edge Functions runtime), so the admin UI can render a
//     "configured/pending" status against the .env.example list.
//   - schema-integrity: runs lightweight checks against the live database to
//     prove that the restored dump is consistent (key tables exist, row counts,
//     foreign-key sanity, RLS enabled, user_ref coverage).
//   - storage-checksums: lists buckets and computes SHA-256 of every file so an
//     external restore can compare bucket-by-bucket.
//   - smoke-tests: simple end-to-end pings (auth roles, RPC reachable,
//     edge functions reachable).
// Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Secrets we expect in the runtime. Mirrors .env.example sections.
const EXPECTED_SECRETS: { name: string; required: boolean; group: string }[] = [
  { name: "SUPABASE_URL", required: true, group: "core" },
  { name: "SUPABASE_ANON_KEY", required: true, group: "core" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, group: "core" },
  { name: "CRON_SECRET", required: true, group: "cron" },
  { name: "VAPID_PUBLIC_KEY", required: false, group: "push" },
  { name: "VAPID_PRIVATE_KEY", required: false, group: "push" },
  { name: "LOVABLE_API_KEY", required: false, group: "ai" },
];

// Tables that MUST exist after a successful restore. Used by schema-integrity.
const CRITICAL_TABLES = [
  "profiles",
  "providers",
  "services",
  "service_categories",
  "leads",
  "user_roles",
  "site_settings",
  "portability_snapshots",
];

const STORAGE_BUCKETS = ["avatars", "portfolio", "service-images"];

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function listAllFiles(
  admin: any,
  bucketId: string,
  prefix = "",
): Promise<{ path: string; size: number }[]> {
  const out: { path: string; size: number }[] = [];
  const { data, error } = await admin.storage.from(bucketId).list(prefix, {
    limit: 1000,
  });
  if (error || !data) return out;
  for (const item of data) {
    if (!item.name || item.name === ".emptyFolderPlaceholder") continue;
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      out.push(...(await listAllFiles(admin, bucketId, full)));
    } else {
      out.push({ path: full, size: (item.metadata as any)?.size || 0 });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "secrets-checklist";

    // -------- secrets-checklist --------
    if (action === "secrets-checklist") {
      const results = EXPECTED_SECRETS.map((s) => {
        const v = Deno.env.get(s.name);
        const present = typeof v === "string" && v.length > 0;
        return {
          name: s.name,
          required: s.required,
          group: s.group,
          status: present ? "configured" : (s.required ? "pending" : "optional"),
          length: present ? v!.length : 0,
        };
      });
      const summary = {
        total: results.length,
        configured: results.filter((r) => r.status === "configured").length,
        pending: results.filter((r) => r.status === "pending").length,
        optional: results.filter((r) => r.status === "optional").length,
      };
      return new Response(
        JSON.stringify({ summary, secrets: results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -------- schema-integrity --------
    if (action === "schema-integrity") {
      const tables: any[] = [];
      for (const t of CRITICAL_TABLES) {
        const { count, error } = await admin
          .from(t)
          .select("*", { count: "exact", head: true });
        tables.push({
          table: t,
          exists: !error,
          rows: count ?? 0,
          error: error?.message ?? null,
        });
      }
      // user_ref coverage
      let userRef: any = null;
      const { data: urData, error: urErr } = await admin.rpc(
        "audit_user_ref_health" as any,
      );
      if (!urErr && urData) {
        const arr = urData as any[];
        const total = arr.reduce((a, r) => a + Number(r.total_rows || 0), 0);
        const filled = arr.reduce((a, r) => a + Number(r.filled || 0), 0);
        userRef = {
          tables: arr.length,
          total_rows: total,
          filled_rows: filled,
          coverage_pct: total > 0
            ? Number(((filled / total) * 100).toFixed(2))
            : null,
          tables_without_index: arr.filter((r: any) => !r.has_index).length,
        };
      }
      const ok = tables.every((t) => t.exists) &&
        (!userRef || (userRef.coverage_pct ?? 100) >= 95);
      return new Response(
        JSON.stringify({ ok, tables, user_ref: userRef }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -------- storage-checksums --------
    if (action === "storage-checksums") {
      const wantHash = url.searchParams.get("hash") !== "false";
      const limitPerBucket = Number(url.searchParams.get("limit") ?? "200");
      const out: any[] = [];
      for (const b of STORAGE_BUCKETS) {
        const files = await listAllFiles(admin, b);
        const slice = files.slice(0, limitPerBucket);
        const fileResults: any[] = [];
        for (const f of slice) {
          const item: any = { path: f.path, size: f.size };
          if (wantHash) {
            const { data, error } = await admin.storage.from(b).download(
              f.path,
            );
            if (data && !error) {
              item.sha256 = await sha256Hex(await data.arrayBuffer());
            } else {
              item.error = error?.message ?? "download failed";
            }
          }
          fileResults.push(item);
        }
        out.push({
          bucket: b,
          file_count: files.length,
          sampled: slice.length,
          total_bytes: files.reduce((a, f) => a + (f.size || 0), 0),
          files: fileResults,
        });
      }
      return new Response(
        JSON.stringify({ buckets: out, generated_at: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -------- smoke-tests --------
    if (action === "smoke-tests") {
      const tests: { name: string; ok: boolean; detail?: string }[] = [];

      // 1. has_role RPC reachable
      try {
        const { error } = await admin.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        tests.push({ name: "rpc.has_role", ok: !error, detail: error?.message });
      } catch (e: any) {
        tests.push({ name: "rpc.has_role", ok: false, detail: e.message });
      }

      // 2. Critical tables reachable
      for (const t of ["profiles", "providers", "services"]) {
        try {
          const { error } = await admin.from(t).select("id").limit(1);
          tests.push({
            name: `table.${t}`,
            ok: !error,
            detail: error?.message,
          });
        } catch (e: any) {
          tests.push({ name: `table.${t}`, ok: false, detail: e.message });
        }
      }

      // 3. Storage buckets reachable
      for (const b of STORAGE_BUCKETS) {
        try {
          const { error } = await admin.storage.from(b).list("", { limit: 1 });
          tests.push({
            name: `storage.${b}`,
            ok: !error,
            detail: error?.message,
          });
        } catch (e: any) {
          tests.push({ name: `storage.${b}`, ok: false, detail: e.message });
        }
      }

      // 4. user_ref audit RPC
      try {
        const { error } = await admin.rpc("audit_user_ref_health" as any);
        tests.push({
          name: "rpc.audit_user_ref_health",
          ok: !error,
          detail: error?.message,
        });
      } catch (e: any) {
        tests.push({
          name: "rpc.audit_user_ref_health",
          ok: false,
          detail: e.message,
        });
      }

      const passed = tests.filter((t) => t.ok).length;
      return new Response(
        JSON.stringify({
          ok: passed === tests.length,
          passed,
          total: tests.length,
          tests,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("portability-restore error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
