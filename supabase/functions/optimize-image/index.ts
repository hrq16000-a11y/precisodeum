import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_BUCKETS = ["service-images", "avatars", "portfolio"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type PathRequest = {
  bucket?: string;
  path?: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isInvalidStoragePath = (value: string) =>
  value.includes("..") || value.includes("//") || value.startsWith("/");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Missing required env vars", {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
        hasAnonKey: !!anonKey,
      });
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await callerClient.auth.getUser();

    if (authError || !user) {
      console.error("Auth failed", authError);
      return jsonResponse({ error: "Unauthenticated" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const { bucket = "service-images", path = "" } = (await req.json()) as PathRequest;

      if (!ALLOWED_BUCKETS.includes(bucket)) {
        return jsonResponse({ error: "Invalid bucket" }, 400);
      }

      if (!path || isInvalidStoragePath(path)) {
        return jsonResponse({ error: "Invalid file path" }, 400);
      }

      const { data: existingFile, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(path);

      if (downloadError || !existingFile) {
        console.error("Download failed", { bucket, path, downloadError });
        return jsonResponse({ error: "File not found" }, 404);
      }

      const fileBytes = new Uint8Array(await existingFile.arrayBuffer());
      const uploadContentType = existingFile.type || "application/octet-stream";

      const { error: uploadError } = await supabase.storage.from(bucket).update(path, fileBytes, {
        contentType: uploadContentType,
      });

      if (uploadError) {
        console.error("Re-upload failed", { bucket, path, uploadError });
        return jsonResponse({ error: "Upload failed" }, 500);
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return jsonResponse({
        url: urlData.publicUrl,
        path,
        deduplicated: false,
        optimized: true,
        mode: "existing-path",
      });
    }

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

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const hashBuffer = await crypto.subtle.digest("SHA-256", uint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

    const originalName = file.name || "image";
    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const isGif = ext === "gif";
    const finalExt = isGif ? "gif" : ext;
    const uploadPath = `${folder ? `${folder}/` : ""}${hash}.${finalExt}`;
    const uploadContentType = isGif ? "image/gif" : file.type || "image/jpeg";

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

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadPath);
    return jsonResponse({
      url: urlData.publicUrl,
      path: uploadPath,
      hash,
      deduplicated: false,
      mode: "upload",
    });
  } catch (err) {
    console.error("optimize-image error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
