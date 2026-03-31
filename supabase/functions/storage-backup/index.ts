import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { JSZip } from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKETS = ["avatars", "portfolio", "service-images"];

async function listAllFiles(
  supabaseAdmin: any,
  bucketId: string,
  prefix = ""
): Promise<{ path: string; size: number }[]> {
  const results: { path: string; size: number }[] = [];
  const { data, error } = await supabaseAdmin.storage
    .from(bucketId)
    .list(prefix, { limit: 1000 });
  if (error || !data) return results;

  for (const item of data) {
    if (!item.name || item.name === ".emptyFolderPlaceholder") continue;
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // folder — recurse
      const sub = await listAllFiles(supabaseAdmin, bucketId, fullPath);
      results.push(...sub);
    } else {
      results.push({
        path: fullPath,
        size: (item.metadata as any)?.size || 0,
      });
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Check user is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
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
    const action = url.searchParams.get("action");

    // ========== EXPORT ==========
    if (action === "export") {
      const bucketFilter = url.searchParams.get("bucket"); // null = all
      const bucketsToExport = bucketFilter
        ? BUCKETS.filter((b) => b === bucketFilter)
        : BUCKETS;

      const zip = new JSZip();
      let fileCount = 0;

      for (const bucketId of bucketsToExport) {
        const files = await listAllFiles(adminClient, bucketId);
        for (const file of files) {
          const { data, error } = await adminClient.storage
            .from(bucketId)
            .download(file.path);
          if (error || !data) {
            console.error(
              `Failed to download ${bucketId}/${file.path}:`,
              error
            );
            continue;
          }
          const arrayBuffer = await data.arrayBuffer();
          zip.file(`${bucketId}/${file.path}`, arrayBuffer);
          fileCount++;
        }
      }

      if (fileCount === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhum arquivo encontrado" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const zipBlob = await zip.generateAsync({ type: "uint8array" });
      const filename = bucketFilter
        ? `storage-${bucketFilter}-${new Date().toISOString().slice(0, 10)}.zip`
        : `storage-backup-${new Date().toISOString().slice(0, 10)}.zip`;

      return new Response(zipBlob, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ========== IMPORT ==========
    if (action === "import") {
      const mode =
        url.searchParams.get("mode") === "preserve" ? "preserve" : "replace";
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "Nenhum arquivo enviado" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if ((zipEntry as any).dir) continue;

        // Parse bucket/path
        const parts = relativePath.split("/");
        if (parts.length < 2) continue;
        const bucketId = parts[0];
        const filePath = parts.slice(1).join("/");

        if (!BUCKETS.includes(bucketId)) {
          errors.push(`Bucket desconhecido: ${bucketId}`);
          continue;
        }

        // Check if file exists when mode=preserve
        if (mode === "preserve") {
          const { data: existing } = await adminClient.storage
            .from(bucketId)
            .list(
              filePath.includes("/")
                ? filePath.substring(0, filePath.lastIndexOf("/"))
                : "",
              { limit: 1, search: filePath.split("/").pop() }
            );
          if (existing && existing.length > 0) {
            skipped++;
            continue;
          }
        }

        const content = await (zipEntry as any).async("uint8array");
        const blob = new Blob([content]);

        const { error: uploadError } = await adminClient.storage
          .from(bucketId)
          .upload(filePath, blob, { upsert: mode === "replace" });

        if (uploadError) {
          errors.push(`${bucketId}/${filePath}: ${uploadError.message}`);
        } else {
          imported++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          imported,
          skipped,
          errors: errors.slice(0, 20),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Action inválida. Use ?action=export ou ?action=import" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("storage-backup error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
