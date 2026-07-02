// portability-bundle: streams a unified ZIP with a manifest describing
// code (GitHub instructions), DB dump pointer and Storage backup pointer.
// The actual heavy ZIP composition uses the same approach as storage-backup
// but adds a manifest.json + .env.example + RESTORE.md inside the archive.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STORAGE_BUCKETS = ["avatars", "portfolio", "service-images"];

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

const ENV_EXAMPLE = `# ====== Lovable Cloud / Supabase ======
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-ref

# ====== Backend / Edge Functions (server-side) ======
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=generate-a-long-random-string

# ====== Web Push (VAPID) ======
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# ====== Lovable AI Gateway (optional) ======
LOVABLE_API_KEY=
`;

const RESTORE_MD = `# RESTORE.md — Guia de restauração

Este ZIP contém o estado portátil do projeto. Para restaurar em outro servidor:

## 1. Código
- Sincronize com seu repositório do GitHub (commit mais recente está descrito em manifest.json).

## 2. Banco de dados
- Importe o arquivo \`db/dump.sql\` (gerado pelo painel Admin → Backup, contém SCHEMA + DADOS).
- Comando sugerido (psql):
  \`\`\`bash
  psql "postgresql://postgres:<senha>@db.<PROJECT_REF>.supabase.co:5432/postgres" -f db/dump.sql
  \`\`\`

## 3. Storage
- Os arquivos estão em \`storage/<bucket>/...\`. Faça upload via:
  - Edge function \`storage-backup?action=import\` (recomendado), OU
  - Supabase CLI: \`supabase storage upload ...\`.

## 4. Variáveis de ambiente
- Copie \`.env.example\` para \`.env\` e preencha com seus segredos.

## 5. Validação
- Use o botão "Validar bundle" na tela /admin/portabilidade após restaurar.
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
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
    const includeStorage = url.searchParams.get("storage") !== "false";
    const includeDbPlaceholder = url.searchParams.get("db") !== "false";
    const persist = url.searchParams.get("persist") === "true";
    const label = url.searchParams.get("label") ||
      `bundle-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;

    // Collect storage files
    const allFiles: { bucket: string; path: string }[] = [];
    if (includeStorage) {
      for (const b of STORAGE_BUCKETS) {
        for (const f of await listAllFiles(admin, b)) {
          allFiles.push({ bucket: b, path: f.path });
        }
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const zip = new JSZip();

        // Manifest
        const manifest = {
          generated_at: new Date().toISOString(),
          generated_by: user.email ?? user.id,
          project_ref: supabaseUrl.replace("https://", "").split(".")[0],
          buckets: STORAGE_BUCKETS,
          file_count: allFiles.length,
          includes: {
            code: false, // code synced via GitHub
            database_dump_placeholder: includeDbPlaceholder,
            storage: includeStorage,
            env_example: true,
            restore_guide: true,
          },
          notes:
            "Para o dump SQL completo (schema + dados), use Admin → Backup → Exportar SQL completo. " +
            "Anexe o arquivo gerado em /db/dump.sql antes de restaurar.",
        };
        zip.file("manifest.json", JSON.stringify(manifest, null, 2));
        zip.file(".env.example", ENV_EXAMPLE);
        zip.file("RESTORE.md", RESTORE_MD);
        if (includeDbPlaceholder) {
          zip.file(
            "db/README.txt",
            "Coloque aqui o arquivo dump.sql exportado pelo painel Admin → Backup (botão 'Exportar SQL completo').",
          );
        }

        controller.enqueue(
          enc.encode(
            JSON.stringify({
              type: "progress",
              processed: 0,
              total: allFiles.length,
            }) + "\n",
          ),
        );

        let processed = 0;
        for (const f of allFiles) {
          const { data, error } = await admin.storage.from(f.bucket).download(
            f.path,
          );
          processed++;
          if (error || !data) {
            controller.enqueue(
              enc.encode(
                JSON.stringify({
                  type: "progress",
                  processed,
                  total: allFiles.length,
                  skipped: `${f.bucket}/${f.path}`,
                }) + "\n",
              ),
            );
            continue;
          }
          const buf = await data.arrayBuffer();
          zip.file(`storage/${f.bucket}/${f.path}`, buf);
          if (processed % 5 === 0 || processed === allFiles.length) {
            controller.enqueue(
              enc.encode(
                JSON.stringify({
                  type: "progress",
                  processed,
                  total: allFiles.length,
                }) + "\n",
              ),
            );
          }
        }

        controller.enqueue(
          enc.encode(
            JSON.stringify({ type: "status", message: "Compactando ZIP..." }) +
              "\n",
          ),
        );

        const zipData = await zip.generateAsync({ type: "uint8array" });

        // Optional persistence as snapshot
        let snapshotId: string | null = null;
        let storagePath: string | null = null;
        if (persist) {
          storagePath = `snapshots/${label}.zip`;
          const { error: upErr } = await admin.storage.from("portability")
            .upload(storagePath, zipData, {
              contentType: "application/zip",
              upsert: true,
            });
          if (upErr) {
            controller.enqueue(
              enc.encode(
                JSON.stringify({
                  type: "warning",
                  message: `Upload falhou: ${upErr.message}`,
                }) + "\n",
              ),
            );
            storagePath = null;
          } else {
            // sha256
            const hashBuf = await crypto.subtle.digest("SHA-256", zipData);
            const checksum = Array.from(new Uint8Array(hashBuf))
              .map((b) => b.toString(16).padStart(2, "0")).join("");
            const { data: row } = await admin.from("portability_snapshots")
              .insert({
                label,
                kind: "full",
                storage_path: storagePath,
                size_bytes: zipData.byteLength,
                file_count: allFiles.length,
                checksum_sha256: checksum,
                manifest,
                created_by: user.id,
                status: "ready",
              }).select("id").single();
            snapshotId = row?.id ?? null;
          }
        }

        // Encode base64 in chunks
        let binary = "";
        const cs = 32768;
        for (let i = 0; i < zipData.length; i += cs) {
          const chunk = zipData.subarray(i, i + cs);
          const arr: string[] = [];
          for (let j = 0; j < chunk.length; j++) {
            arr.push(String.fromCharCode(chunk[j]));
          }
          binary += arr.join("");
        }
        const b64 = btoa(binary);

        controller.enqueue(
          enc.encode(
            JSON.stringify({
              type: "complete",
              filename: `${label}.zip`,
              data: b64,
              snapshot_id: snapshotId,
              storage_path: storagePath,
              file_count: allFiles.length,
              size_bytes: zipData.byteLength,
            }) + "\n",
          ),
        );

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("portability-bundle error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
