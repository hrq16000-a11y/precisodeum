import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const SCAN_LIMIT = 200;

const BUCKET_CONFIG: Record<string, { maxSize: number; maxWidth: number; quality: number }> = {
  avatars: { maxSize: 200 * 1024, maxWidth: 512, quality: 80 },
  "service-images": { maxSize: 300 * 1024, maxWidth: 1200, quality: 80 },
  portfolio: { maxSize: 200 * 1024, maxWidth: 1200, quality: 80 },
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function optimizeViaTransform(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string,
  path: string,
  maxWidth: number,
  quality: number
): Promise<{ data: Uint8Array; contentType: string } | null> {
  const url = `${supabaseUrl}/storage/v1/render/image/public/${bucket}/${path}?width=${maxWidth}&quality=${quality}&resize=contain`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/webp";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 100) return null;
    return { data: buf, contentType: ct };
  } catch {
    return null;
  }
}

async function listRecursive(
  supabase: any,
  bucket: string,
  folder: string
): Promise<{ path: string; size: number; name: string }[]> {
  const results: { path: string; size: number; name: string }[] = [];
  const { data } = await supabase.storage
    .from(bucket)
    .list(folder || undefined, { limit: SCAN_LIMIT });
  if (!data) return results;

  for (const entry of data) {
    if (!entry.name || entry.name === ".emptyFolderPlaceholder") continue;
    const fullPath = folder ? `${folder}/${entry.name}` : entry.name;
    const meta = entry.metadata as any;
    const size = meta?.size || 0;

    if (meta?.mimetype || size > 0) {
      results.push({ path: fullPath, size, name: entry.name });
    } else {
      const sub = await listRecursive(supabase, bucket, fullPath);
      results.push(...sub);
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: accept CRON_SECRET header or admin JWT
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");
    const cronHeader = req.headers.get("x-cron-secret");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (cronHeader && cronSecret && cronHeader === cronSecret) {
      // Authorized via cron secret
    } else if (authHeader) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await callerClient.auth.getUser();
      if (authError || !user) return jsonResponse({ error: "Unauthenticated" }, 401);
      const { data: roleCheck } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!roleCheck) return jsonResponse({ error: "Admin access required" }, 403);
    } else {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Optional bucket filter
    let filterBucket: string | null = null;
    try {
      const url = new URL(req.url);
      filterBucket = url.searchParams.get("bucket");
    } catch { /* ignore */ }

    const buckets = filterBucket
      ? [filterBucket].filter((b) => b in BUCKET_CONFIG)
      : Object.keys(BUCKET_CONFIG);

    const summary: Record<string, { scanned: number; eligible: number; optimized: number; skipped: number; savings_kb: number; errors: string[] }> = {};
    let grandTotalSaved = 0;
    let grandTotalOptimized = 0;

    for (const bucket of buckets) {
      const config = BUCKET_CONFIG[bucket];
      console.log(`Scanning bucket: ${bucket}...`);

      const allFiles = await listRecursive(supabase, bucket, "");
      const eligible = allFiles.filter((f) => {
        if (f.size <= config.maxSize) return false;
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        return ALLOWED_EXTENSIONS.includes(ext);
      });

      console.log(`${bucket}: ${allFiles.length} files, ${eligible.length} eligible`);

      let optimized = 0;
      let skipped = 0;
      let savingsBytes = 0;
      const errors: string[] = [];

      for (const file of eligible) {
        try {
          let result = await optimizeViaTransform(
            supabaseUrl, serviceRoleKey, bucket, file.path,
            config.maxWidth, config.quality
          );

          // Retry with lower quality
          if (result && result.data.length > config.maxSize) {
            const retry = await optimizeViaTransform(
              supabaseUrl, serviceRoleKey, bucket, file.path,
              config.maxWidth, 60
            );
            if (retry && retry.data.length < result.data.length) result = retry;
          }

          // Retry with smaller width
          if (result && result.data.length > config.maxSize) {
            const retry = await optimizeViaTransform(
              supabaseUrl, serviceRoleKey, bucket, file.path,
              Math.round(config.maxWidth * 0.6), 50
            );
            if (retry && retry.data.length < result.data.length) result = retry;
          }

          if (!result || result.data.length >= file.size) {
            skipped++;
            continue;
          }

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .update(file.path, result.data, {
              contentType: result.contentType,
              upsert: true,
            });

          if (uploadError) {
            errors.push(`${file.path}: upload failed`);
            continue;
          }

          const saved = file.size - result.data.length;
          savingsBytes += saved;
          optimized++;
          grandTotalSaved += saved;
          grandTotalOptimized++;

          // Update media table (best-effort)
          try {
            await supabase
              .from("media")
              .update({ size_optimized: result.data.length, mime_type: result.contentType })
              .eq("storage_path", `${bucket}/${file.path}`);
          } catch { /* best-effort */ }

          console.log(
            `✅ ${bucket}/${file.path}: ${Math.round(file.size / 1024)}KB → ${Math.round(result.data.length / 1024)}KB`
          );
        } catch (err) {
          errors.push(`${file.path}: ${String(err)}`);
        }
      }

      summary[bucket] = {
        scanned: allFiles.length,
        eligible: eligible.length,
        optimized,
        skipped,
        savings_kb: Math.round(savingsBytes / 1024),
        errors,
      };
    }

    const result = {
      buckets: summary,
      grand_total_optimized: grandTotalOptimized,
      grand_total_savings_kb: Math.round(grandTotalSaved / 1024),
      message: `Otimização concluída: ${grandTotalOptimized} arquivo(s), ${Math.round(grandTotalSaved / 1024)}KB economizado(s)`,
    };

    console.log("Batch optimize result:", JSON.stringify(result));
    return jsonResponse(result);
  } catch (err) {
    console.error("batch-optimize-all error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
