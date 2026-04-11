import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_SIZE = 200 * 1024; // 200KB threshold
const SCAN_LIMIT = 200;
const TARGET_QUALITY = 80;
const TARGET_MAX_WIDTH = 1200;
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function optimizeViaTransform(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  maxWidth: number,
  quality: number
): Promise<{ data: Uint8Array; contentType: string } | null> {
  const url = `${supabaseUrl}/storage/v1/render/image/public/portfolio/${path}?width=${maxWidth}&quality=${quality}&resize=contain`;
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
  folder: string
): Promise<{ path: string; size: number; name: string }[]> {
  const results: { path: string; size: number; name: string }[] = [];
  const { data } = await supabase.storage
    .from("portfolio")
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
      // It's a folder — recurse
      const sub = await listRecursive(supabase, fullPath);
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

    // Auth check — require admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await callerClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthenticated" }, 401);

    // Check admin role
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleCheck } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!roleCheck) return jsonResponse({ error: "Admin access required" }, 403);

    // List all files recursively
    console.log("Scanning portfolio bucket...");
    const allFiles = await listRecursive(supabase, "");
    console.log(`Found ${allFiles.length} files total`);

    // Filter eligible files
    const eligible = allFiles.filter((f) => {
      if (f.size <= MAX_SIZE) return false;
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return ALLOWED_EXTENSIONS.includes(ext);
    });
    console.log(`${eligible.length} files eligible for optimization`);

    let totalOptimized = 0;
    let totalSkipped = 0;
    let totalSavingsBytes = 0;
    const errors: string[] = [];

    // Process files
    for (const file of eligible) {
      try {
        // Try optimize
        let optimized = await optimizeViaTransform(
          supabaseUrl,
          serviceRoleKey,
          file.path,
          TARGET_MAX_WIDTH,
          TARGET_QUALITY
        );

        // Retry with lower quality if still too big
        if (optimized && optimized.data.length > MAX_SIZE) {
          const retry = await optimizeViaTransform(
            supabaseUrl,
            serviceRoleKey,
            file.path,
            TARGET_MAX_WIDTH,
            60
          );
          if (retry && retry.data.length < optimized.data.length) {
            optimized = retry;
          }
        }

        // Retry with smaller width
        if (optimized && optimized.data.length > MAX_SIZE) {
          const retry = await optimizeViaTransform(
            supabaseUrl,
            serviceRoleKey,
            file.path,
            800,
            50
          );
          if (retry && retry.data.length < optimized.data.length) {
            optimized = retry;
          }
        }

        if (!optimized || optimized.data.length >= file.size) {
          totalSkipped++;
          continue;
        }

        // Re-upload optimized version
        const { error: uploadError } = await supabase.storage
          .from("portfolio")
          .update(file.path, optimized.data, {
            contentType: optimized.contentType,
            upsert: true,
          });

        if (uploadError) {
          errors.push(`${file.path}: upload failed`);
          continue;
        }

        const saved = file.size - optimized.data.length;
        totalSavingsBytes += saved;
        totalOptimized++;

        // Update media table (best-effort)
        try {
          await supabase
            .from("media")
            .update({
              size_optimized: optimized.data.length,
              mime_type: optimized.contentType,
            })
            .eq("storage_path", `portfolio/${file.path}`);
        } catch {
          /* best-effort */
        }

        console.log(
          `Optimized: ${file.path} (${Math.round(file.size / 1024)}KB → ${Math.round(optimized.data.length / 1024)}KB)`
        );
      } catch (err) {
        errors.push(`${file.path}: ${String(err)}`);
      }
    }

    const result = {
      total_scanned: allFiles.length,
      total_eligible: eligible.length,
      total_optimized: totalOptimized,
      total_skipped: totalSkipped,
      savings_kb: Math.round(totalSavingsBytes / 1024),
      errors,
      message: `Otimização concluída: ${totalOptimized} arquivo(s) otimizado(s), ${Math.round(totalSavingsBytes / 1024)}KB economizado(s)`,
    };

    console.log("Batch optimize result:", JSON.stringify(result));
    return jsonResponse(result);
  } catch (err) {
    console.error("batch-optimize-portfolio error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
