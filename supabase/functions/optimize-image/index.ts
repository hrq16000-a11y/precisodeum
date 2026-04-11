import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_BUCKETS = ["service-images", "avatars", "portfolio", "sponsors"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
const TARGET_MAX_WIDTH = 1200;
const TARGET_MAX_HEIGHT = 1200;
const TARGET_QUALITY = 80;
const TARGET_MAX_BYTES = 200 * 1024; // 200KB target

type PathRequest = {
  bucket?: string;
  path?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isInvalidStoragePath = (value: string) =>
  value.includes("..") || value.includes("//") || value.startsWith("/");

/**
 * Uses Supabase Image Transformation (render/image) to get an optimized version.
 * Falls back to re-encoding if transforms are not available.
 */
async function optimizeViaTransform(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string,
  path: string,
  maxWidth: number,
  quality: number
): Promise<{ data: Uint8Array; contentType: string } | null> {
  // Supabase Image Transforms: GET /storage/v1/render/image/public/{bucket}/{path}?width=X&quality=Y
  const transformUrl = `${supabaseUrl}/storage/v1/render/image/public/${bucket}/${path}?width=${maxWidth}&quality=${quality}&resize=contain`;
  
  try {
    const res = await fetch(transformUrl, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!res.ok) {
      console.log(`Transform API returned ${res.status}, falling back`);
      return null;
    }

    const ct = res.headers.get("content-type") || "image/webp";
    const buf = new Uint8Array(await res.arrayBuffer());

    if (buf.length < 100) {
      console.log("Transform returned too small result, skipping");
      return null;
    }

    return { data: buf, contentType: ct };
  } catch (err) {
    console.error("Transform fetch failed:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthenticated" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const contentType = req.headers.get("content-type") || "";

    // ──────────────────────────────────────────────
    // MODE 1: Optimize an EXISTING file by path
    // ──────────────────────────────────────────────
    if (contentType.includes("application/json")) {
      const {
        bucket = "service-images",
        path = "",
        maxWidth = TARGET_MAX_WIDTH,
        quality = TARGET_QUALITY,
      } = (await req.json()) as PathRequest;

      if (!ALLOWED_BUCKETS.includes(bucket)) {
        return jsonResponse({ error: "Invalid bucket" }, 400);
      }
      if (!path || isInvalidStoragePath(path)) {
        return jsonResponse({ error: "Invalid file path" }, 400);
      }

      // Skip GIFs (animated)
      if (path.toLowerCase().endsWith(".gif")) {
        return jsonResponse({ error: "GIF files cannot be optimized (may be animated)" }, 400);
      }

      // Download original to get its size
      const { data: originalFile, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(path);

      if (downloadError || !originalFile) {
        return jsonResponse({ error: "File not found" }, 404);
      }

      const originalBytes = await originalFile.arrayBuffer();
      const originalSize = originalBytes.byteLength;

      // If already under target, skip
      if (originalSize <= TARGET_MAX_BYTES) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        return jsonResponse({
          url: urlData.publicUrl,
          path,
          optimized: false,
          reason: "already_small",
          original_size: originalSize,
          message: `Arquivo já está dentro do limite (${Math.round(originalSize / 1024)}KB)`,
        });
      }

      // Try Supabase Image Transforms first
      let optimizedData = await optimizeViaTransform(
        supabaseUrl, serviceRoleKey, bucket, path, maxWidth, quality
      );

      // If transform didn't help enough, try with lower quality
      if (optimizedData && optimizedData.data.length > TARGET_MAX_BYTES && quality > 50) {
        const retry = await optimizeViaTransform(
          supabaseUrl, serviceRoleKey, bucket, path, maxWidth, Math.max(50, quality - 20)
        );
        if (retry && retry.data.length < optimizedData.data.length) {
          optimizedData = retry;
        }
      }

      // If transform didn't help enough, try with smaller width
      if (optimizedData && optimizedData.data.length > TARGET_MAX_BYTES) {
        const retry = await optimizeViaTransform(
          supabaseUrl, serviceRoleKey, bucket, path, 800, 60
        );
        if (retry && retry.data.length < optimizedData.data.length) {
          optimizedData = retry;
        }
      }

      if (!optimizedData || optimizedData.data.length >= originalSize) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        return jsonResponse({
          url: urlData.publicUrl,
          path,
          optimized: false,
          reason: "no_improvement",
          original_size: originalSize,
          message: "Otimização não reduziu o tamanho do arquivo",
        });
      }

      // Re-upload the optimized version in-place
      const { error: uploadError } = await supabase.storage.from(bucket).update(path, optimizedData.data, {
        contentType: optimizedData.contentType,
        upsert: true,
      });

      if (uploadError) {
        console.error("Re-upload optimized failed", { bucket, path, uploadError });
        return jsonResponse({ error: "Upload failed: " + uploadError.message }, 500);
      }

      // Update media table if exists
      try {
        await supabase.from("media").update({
          size_optimized: optimizedData.data.length,
          mime_type: optimizedData.contentType,
        }).eq("storage_path", `${bucket}/${path}`);
      } catch { /* media table update is best-effort */ }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const savings = Math.round((1 - optimizedData.data.length / originalSize) * 100);

      return jsonResponse({
        url: urlData.publicUrl,
        path,
        optimized: true,
        original_size: originalSize,
        optimized_size: optimizedData.data.length,
        savings_percent: savings,
        message: `Otimizado: ${Math.round(originalSize / 1024)}KB → ${Math.round(optimizedData.data.length / 1024)}KB (-${savings}%)`,
      });
    }

    // ──────────────────────────────────────────────
    // MODE 2: Upload a NEW file with optimization
    // ──────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "service-images";
    const folder = (formData.get("folder") as string) || "";

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return jsonResponse({ error: "Invalid bucket" }, 400);
    }
    if (folder && isInvalidStoragePath(folder)) {
      return jsonResponse({ error: "Invalid folder path" }, 400);
    }
    if (!file) {
      return jsonResponse({ error: "No file provided" }, 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse({ error: "File too large. Max 5MB." }, 400);
    }

    const originalName = file.name || "image";
    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return jsonResponse({ error: "Invalid file type. Allowed: jpg, png, gif, webp." }, 400);
    }
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return jsonResponse({ error: "Invalid MIME type. Allowed: jpeg, png, gif, webp." }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Hash for deduplication
    const hashBuffer = await crypto.subtle.digest("SHA-256", uint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

    const isGif = ext === "gif";
    const finalExt = isGif ? "gif" : ext;
    const uploadPath = `${folder ? `${folder}/` : ""}${hash}.${finalExt}`;
    const uploadContentType = isGif ? "image/gif" : file.type || "image/jpeg";

    // Check for existing duplicate
    const { data: existing } = await supabase.storage.from(bucket).list(folder || undefined, {
      search: `${hash}.`,
    });

    const existingFile = existing?.find((entry) => entry.name.startsWith(hash));
    if (existingFile) {
      const existingPath = folder ? `${folder}/${existingFile.name}` : existingFile.name;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(existingPath);
      return jsonResponse({
        url: urlData.publicUrl,
        path: existingPath,
        deduplicated: true,
      });
    }

    const { error: uploadError } = await supabase.storage.from(bucket).upload(uploadPath, uint8, {
      contentType: uploadContentType,
      upsert: true,
    });

    if (uploadError) {
      console.error("Upload failed", uploadError);
      return jsonResponse({ error: "Upload failed" }, 500);
    }

    const originalSize = uint8.length;
    let optimizedSize = originalSize;
    let savingsPercent = 0;
    let finalContentType = uploadContentType;

    // Post-upload optimization (skip GIFs)
    if (!isGif && originalSize > TARGET_MAX_BYTES) {
      let optimizedData = await optimizeViaTransform(
        supabaseUrl, serviceRoleKey, bucket, uploadPath,
        TARGET_MAX_WIDTH, TARGET_QUALITY
      );

      if (optimizedData && optimizedData.data.length > TARGET_MAX_BYTES && TARGET_QUALITY > 50) {
        const retry = await optimizeViaTransform(
          supabaseUrl, serviceRoleKey, bucket, uploadPath,
          TARGET_MAX_WIDTH, Math.max(50, TARGET_QUALITY - 20)
        );
        if (retry && retry.data.length < (optimizedData?.data.length ?? Infinity)) {
          optimizedData = retry;
        }
      }

      if (optimizedData && optimizedData.data.length > TARGET_MAX_BYTES) {
        const retry = await optimizeViaTransform(
          supabaseUrl, serviceRoleKey, bucket, uploadPath, 800, 60
        );
        if (retry && retry.data.length < (optimizedData?.data.length ?? Infinity)) {
          optimizedData = retry;
        }
      }

      if (optimizedData && optimizedData.data.length < originalSize) {
        const { error: updateErr } = await supabase.storage.from(bucket).update(uploadPath, optimizedData.data, {
          contentType: optimizedData.contentType,
          upsert: true,
        });
        if (!updateErr) {
          optimizedSize = optimizedData.data.length;
          finalContentType = optimizedData.contentType;
          savingsPercent = Math.round((1 - optimizedSize / originalSize) * 100);
          console.log(`Optimized ${uploadPath}: ${Math.round(originalSize/1024)}KB → ${Math.round(optimizedSize/1024)}KB (-${savingsPercent}%)`);
        }
      }
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadPath);
    return jsonResponse({
      url: urlData.publicUrl,
      path: uploadPath,
      hash,
      deduplicated: false,
      mode: "upload",
      original_size: originalSize,
      optimized_size: optimizedSize,
      savings_percent: savingsPercent,
    });
  } catch (err) {
    console.error("optimize-image error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
