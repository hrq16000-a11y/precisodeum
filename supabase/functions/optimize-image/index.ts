import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_BUCKETS = ["service-images", "avatars", "portfolio", "sponsors"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];

/** Per-bucket optimization profiles */
const BUCKET_PROFILES: Record<string, { maxWidth: number; targetKB: number; quality: number }> = {
  avatars:          { maxWidth: 512,  targetKB: 150, quality: 75 },
  "service-images": { maxWidth: 1200, targetKB: 250, quality: 78 },
  portfolio:        { maxWidth: 1200, targetKB: 200, quality: 78 },
  sponsors:         { maxWidth: 800,  targetKB: 200, quality: 75 },
};

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
 * Multi-pass optimization via Supabase Image Transforms.
 * Tries progressively more aggressive settings until target is met.
 */
async function optimizeMultiPass(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string,
  path: string,
  targetBytes: number,
  profile: { maxWidth: number; quality: number }
): Promise<{ data: Uint8Array; contentType: string } | null> {
  const passes = [
    { width: profile.maxWidth, quality: profile.quality },
    { width: profile.maxWidth, quality: Math.max(50, profile.quality - 15) },
    { width: Math.round(profile.maxWidth * 0.75), quality: 55 },
    { width: Math.round(profile.maxWidth * 0.6), quality: 45 },
    { width: Math.round(profile.maxWidth * 0.5), quality: 40 },
  ];

  let best: { data: Uint8Array; contentType: string } | null = null;

  for (const pass of passes) {
    const transformUrl = `${supabaseUrl}/storage/v1/render/image/public/${bucket}/${path}?width=${pass.width}&quality=${pass.quality}&resize=contain`;

    try {
      const res = await fetch(transformUrl, {
        headers: { Authorization: `Bearer ${serviceRoleKey}` },
      });

      if (!res.ok) {
        console.log(`Transform API returned ${res.status} for pass w=${pass.width} q=${pass.quality}`);
        continue;
      }

      const ct = res.headers.get("content-type") || "image/webp";
      const buf = new Uint8Array(await res.arrayBuffer());

      if (buf.length < 100) continue;

      // Always keep the smallest result
      if (!best || buf.length < best.data.length) {
        best = { data: buf, contentType: ct };
      }

      // If under target, stop early
      if (buf.length <= targetBytes) {
        return best;
      }
    } catch (err) {
      console.error(`Transform pass failed (w=${pass.width}, q=${pass.quality}):`, err);
    }
  }

  return best;
}

/**
 * Update all database references when a file is re-optimized in-place.
 * This ensures link integrity even when content-type changes.
 */
async function syncMediaRecord(
  supabase: any,
  bucket: string,
  path: string,
  optimizedSize: number,
  contentType: string
) {
  try {
    await supabase.from("media").update({
      size_optimized: optimizedSize,
      mime_type: contentType,
    }).eq("storage_path", `${bucket}/${path}`);
  } catch { /* best-effort */ }
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
        maxWidth,
        quality,
      } = (await req.json()) as PathRequest;

      if (!ALLOWED_BUCKETS.includes(bucket)) {
        return jsonResponse({ error: "Invalid bucket" }, 400);
      }
      if (!path || isInvalidStoragePath(path)) {
        return jsonResponse({ error: "Invalid file path" }, 400);
      }
      if (path.toLowerCase().endsWith(".gif")) {
        return jsonResponse({ error: "GIF files cannot be optimized (may be animated)" }, 400);
      }

      const profile = BUCKET_PROFILES[bucket] || BUCKET_PROFILES["service-images"];
      const targetBytes = profile.targetKB * 1024;
      const effectiveProfile = {
        maxWidth: maxWidth || profile.maxWidth,
        quality: quality || profile.quality,
      };

      // Download original
      const { data: originalFile, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(path);

      if (downloadError || !originalFile) {
        return jsonResponse({ error: "File not found" }, 404);
      }

      const originalBytes = await originalFile.arrayBuffer();
      const originalSize = originalBytes.byteLength;

      if (originalSize <= targetBytes) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        return jsonResponse({
          url: urlData.publicUrl,
          path,
          optimized: false,
          reason: "already_small",
          original_size: originalSize,
          message: `Arquivo já otimizado (${Math.round(originalSize / 1024)}KB)`,
        });
      }

      // Multi-pass optimization
      const optimized = await optimizeMultiPass(
        supabaseUrl, serviceRoleKey, bucket, path, targetBytes, effectiveProfile
      );

      if (!optimized || optimized.data.length >= originalSize) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        return jsonResponse({
          url: urlData.publicUrl,
          path,
          optimized: false,
          reason: "no_improvement",
          original_size: originalSize,
        });
      }

      // Re-upload in-place (SAME PATH = SAME URL = LINK PRESERVED)
      const { error: uploadError } = await supabase.storage.from(bucket).update(path, optimized.data, {
        contentType: optimized.contentType,
        upsert: true,
      });

      if (uploadError) {
        console.error("Re-upload failed", { bucket, path, uploadError });
        return jsonResponse({ error: "Upload failed: " + uploadError.message }, 500);
      }

      await syncMediaRecord(supabase, bucket, path, optimized.data.length, optimized.contentType);

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const savings = Math.round((1 - optimized.data.length / originalSize) * 100);

      return jsonResponse({
        url: urlData.publicUrl,
        path,
        optimized: true,
        original_size: originalSize,
        optimized_size: optimized.data.length,
        savings_percent: savings,
        content_type: optimized.contentType,
        message: `Otimizado: ${Math.round(originalSize / 1024)}KB → ${Math.round(optimized.data.length / 1024)}KB (-${savings}%)`,
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
      return jsonResponse({ error: "Invalid file type. Allowed: jpg, png, gif, webp, avif." }, 400);
    }
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return jsonResponse({ error: "Invalid MIME type." }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Hash for deduplication (content-based, format-agnostic)
    const hashBuffer = await crypto.subtle.digest("SHA-256", uint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

    const isGif = ext === "gif";
    const finalExt = isGif ? "gif" : ext;
    const uploadPath = `${folder ? `${folder}/` : ""}${hash}.${finalExt}`;
    const uploadContentType = isGif ? "image/gif" : file.type || "image/jpeg";

    // Check for existing duplicate (any format with same hash)
    const { data: existing } = await supabase.storage.from(bucket).list(folder || undefined, {
      search: `${hash}.`,
    });

    const existingFile = existing?.find((entry: any) => entry.name.startsWith(hash));
    if (existingFile) {
      const existingPath = folder ? `${folder}/${existingFile.name}` : existingFile.name;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(existingPath);
      return jsonResponse({
        url: urlData.publicUrl,
        path: existingPath,
        deduplicated: true,
      });
    }

    // Upload original first
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
    const profile = BUCKET_PROFILES[bucket] || BUCKET_PROFILES["service-images"];
    const targetBytes = profile.targetKB * 1024;

    // Post-upload multi-pass optimization (skip GIFs)
    if (!isGif && originalSize > targetBytes) {
      const optimized = await optimizeMultiPass(
        supabaseUrl, serviceRoleKey, bucket, uploadPath, targetBytes,
        { maxWidth: profile.maxWidth, quality: profile.quality }
      );

      if (optimized && optimized.data.length < originalSize) {
        const { error: updateErr } = await supabase.storage.from(bucket).update(uploadPath, optimized.data, {
          contentType: optimized.contentType,
          upsert: true,
        });
        if (!updateErr) {
          optimizedSize = optimized.data.length;
          finalContentType = optimized.contentType;
          savingsPercent = Math.round((1 - optimizedSize / originalSize) * 100);
          console.log(`✅ Optimized ${uploadPath}: ${Math.round(originalSize / 1024)}KB → ${Math.round(optimizedSize / 1024)}KB (-${savingsPercent}%)`);
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
      content_type: finalContentType,
    });
  } catch (err) {
    console.error("optimize-image error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
