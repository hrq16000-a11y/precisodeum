// portability-restore: server-side helpers for the "Restore in new host" flow.
// Actions:
//   - secrets-checklist        : env vars / secrets configured at runtime
//   - schema-integrity         : tables exist + user_ref coverage vs configurable threshold
//   - storage-checksums        : SHA-256 of every file in known buckets
//   - storage-checksums-compare: compares current checksums against an uploaded manifest
//   - smoke-tests              : extended end-to-end pings (search, category browse, RPCs)
// Admin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const EXPECTED_SECRETS: { name: string; required: boolean; group: string }[] = [
  { name: "SUPABASE_URL", required: true, group: "core" },
  { name: "SUPABASE_ANON_KEY", required: true, group: "core" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, group: "core" },
  { name: "CRON_SECRET", required: true, group: "cron" },
  { name: "VAPID_PUBLIC_KEY", required: false, group: "push" },
  { name: "VAPID_PRIVATE_KEY", required: false, group: "push" },
  { name: "LOVABLE_API_KEY", required: false, group: "ai" },
];

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

async function getSetting(admin: any, key: string, fallback: any) {
  try {
    const { data } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return data?.value ?? fallback;
  } catch {
    return fallback;
  }
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
      return new Response(JSON.stringify({ summary, secrets: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- schema-integrity (uses configurable coverage threshold) --------
    if (action === "schema-integrity") {
      const minCoverage = Number(
        await getSetting(admin, "restore_min_user_ref_coverage_pct", 95),
      );
      const strict = Boolean(
        await getSetting(admin, "restore_strict_mode", true),
      );

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
          min_required_pct: minCoverage,
          strict_mode: strict,
        };
      }

      const tablesOk = tables.every((t) => t.exists);
      const coverageOk = !userRef ||
        (userRef.coverage_pct ?? 100) >= minCoverage;
      const ok = tablesOk && (strict ? coverageOk : true);

      return new Response(
        JSON.stringify({
          ok,
          tables,
          user_ref: userRef,
          coverage_below_threshold: !coverageOk,
        }),
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

    // -------- storage-checksums-compare --------
    // Body: { manifest: { buckets: [{ bucket, files: [{path, sha256, size}] }] } }
    if (action === "storage-checksums-compare" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const manifest = body?.manifest;
      if (!manifest?.buckets || !Array.isArray(manifest.buckets)) {
        return new Response(
          JSON.stringify({ error: "invalid manifest payload" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const report: any[] = [];
      let totalDiverged = 0;
      let totalMissing = 0;
      let totalExtra = 0;
      let totalOk = 0;

      for (const mb of manifest.buckets) {
        if (!STORAGE_BUCKETS.includes(mb.bucket)) continue;
        const files = await listAllFiles(admin, mb.bucket);
        const currentMap = new Map<string, { size: number }>();
        for (const f of files) currentMap.set(f.path, { size: f.size });

        const expectedMap = new Map<
          string,
          { sha256?: string; size?: number }
        >();
        for (const f of mb.files || []) {
          expectedMap.set(f.path, { sha256: f.sha256, size: f.size });
        }

        const diverged: any[] = [];
        const missing: string[] = [];
        const extra: string[] = [];
        let okCount = 0;

        for (const [path, expected] of expectedMap.entries()) {
          const cur = currentMap.get(path);
          if (!cur) {
            missing.push(path);
            continue;
          }
          // download + hash
          const { data, error } = await admin.storage.from(mb.bucket).download(
            path,
          );
          if (error || !data) {
            diverged.push({ path, reason: error?.message ?? "download failed" });
            continue;
          }
          const sha = await sha256Hex(await data.arrayBuffer());
          if (expected.sha256 && expected.sha256 !== sha) {
            diverged.push({
              path,
              reason: "sha256 mismatch",
              expected: expected.sha256,
              actual: sha,
            });
          } else if (expected.size != null && expected.size !== cur.size) {
            diverged.push({
              path,
              reason: "size mismatch",
              expected: expected.size,
              actual: cur.size,
            });
          } else {
            okCount++;
          }
        }
        for (const [path] of currentMap.entries()) {
          if (!expectedMap.has(path)) extra.push(path);
        }

        totalDiverged += diverged.length;
        totalMissing += missing.length;
        totalExtra += extra.length;
        totalOk += okCount;

        report.push({
          bucket: mb.bucket,
          expected: expectedMap.size,
          present: currentMap.size,
          ok: okCount,
          diverged,
          missing,
          extra,
        });
      }

      const ok = totalDiverged === 0 && totalMissing === 0;
      return new Response(
        JSON.stringify({
          ok,
          summary: {
            ok_files: totalOk,
            diverged: totalDiverged,
            missing: totalMissing,
            extra: totalExtra,
          },
          report,
          generated_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -------- smoke-tests (extended) --------
    if (action === "smoke-tests") {
      const tests: { name: string; ok: boolean; detail?: string }[] = [];

      // 1. has_role RPC
      try {
        const { error } = await admin.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        tests.push({ name: "rpc.has_role", ok: !error, detail: error?.message });
      } catch (e: any) {
        tests.push({ name: "rpc.has_role", ok: false, detail: e.message });
      }

      // 2. validate_db_health RPC
      try {
        const { data, error } = await admin.rpc("validate_db_health" as any);
        tests.push({
          name: "rpc.validate_db_health",
          ok: !error && (data as any)?.ok === true,
          detail: error?.message ??
            (!(data as any)?.ok ? "health check returned ok=false" : undefined),
        });
      } catch (e: any) {
        tests.push({
          name: "rpc.validate_db_health",
          ok: false,
          detail: e.message,
        });
      }

      // 3. user_ref audit RPC
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

      // 4. Critical tables reachable
      for (const t of ["profiles", "providers", "services", "leads", "service_categories"]) {
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

      // 5. Storage buckets reachable
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

      // 6. SEARCH smoke tests — sample categories and cities, verify basic queries return
      try {
        const { data: cats, error: catErr } = await admin
          .from("service_categories")
          .select("id, slug, name")
          .limit(3);
        tests.push({
          name: "search.service_categories.sample",
          ok: !catErr && Array.isArray(cats) && cats.length > 0,
          detail: catErr?.message ??
            (!cats?.length ? "no categories found" : undefined),
        });

        // services by sample category
        if (cats && cats.length > 0) {
          const { error: svcErr, count } = await admin
            .from("services")
            .select("id", { count: "exact", head: true })
            .eq("category_id", cats[0].id);
          tests.push({
            name: `search.services.by_category[${cats[0].slug}]`,
            ok: !svcErr,
            detail: svcErr?.message ?? `count=${count ?? 0}`,
          });
        }
      } catch (e: any) {
        tests.push({ name: "search.categories", ok: false, detail: e.message });
      }

      // 7. Search providers by sample city
      try {
        const { data: cities, error: cityErr } = await admin
          .from("cities")
          .select("id, name, state_uf")
          .limit(3);
        tests.push({
          name: "search.cities.sample",
          ok: !cityErr && Array.isArray(cities) && cities.length > 0,
          detail: cityErr?.message,
        });
        if (cities && cities.length > 0) {
          const { error: provErr, count } = await admin
            .from("providers")
            .select("id", { count: "exact", head: true })
            .eq("city", cities[0].name);
          tests.push({
            name: `search.providers.by_city[${cities[0].name}/${cities[0].state_uf}]`,
            ok: !provErr,
            detail: provErr?.message ?? `count=${count ?? 0}`,
          });
        }
      } catch (e: any) {
        tests.push({ name: "search.cities", ok: false, detail: e.message });
      }

      // 8. Full-text-ish search on services (deep search smoke)
      try {
        const { error } = await admin
          .from("services")
          .select("id, name")
          .ilike("name", "%a%")
          .limit(5);
        tests.push({
          name: "search.services.ilike",
          ok: !error,
          detail: error?.message,
        });
      } catch (e: any) {
        tests.push({ name: "search.services.ilike", ok: false, detail: e.message });
      }

      // 9. nearby_providers RPC
      try {
        const { error } = await admin.rpc("nearby_providers" as any, {
          _lat: -23.55,
          _lng: -46.63,
          _radius_km: 50,
          _limit: 5,
        });
        tests.push({
          name: "rpc.nearby_providers",
          ok: !error,
          detail: error?.message,
        });
      } catch (e: any) {
        tests.push({
          name: "rpc.nearby_providers",
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
