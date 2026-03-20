import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bucket = (formData.get('bucket') as string) || 'service-images';
    const folder = (formData.get('folder') as string) || '';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large. Max 1MB.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Generate hash to detect duplicates
    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

    // Determine extension — keep original for GIF (animated), use original for others
    const originalName = file.name || 'image';
    const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    const isGif = ext === 'gif';
    const finalExt = isGif ? 'gif' : ext;
    const contentType = isGif ? 'image/gif' : file.type || 'image/jpeg';

    const basePath = folder ? `${folder}/${hash}` : hash;
    const filePath = `${basePath}.${finalExt}`;

    // Check if file already exists (deduplication)
    const { data: existing } = await supabase.storage.from(bucket).list(folder || undefined, {
      search: `${hash}.`,
    });

    if (existing && existing.length > 0) {
      const existingFile = existing.find(f => f.name.startsWith(hash));
      if (existingFile) {
        const existingPath = folder ? `${folder}/${existingFile.name}` : existingFile.name;
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(existingPath);
        return new Response(JSON.stringify({
          url: urlData.publicUrl,
          path: existingPath,
          deduplicated: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Upload file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, uint8, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return new Response(JSON.stringify({
      url: urlData.publicUrl,
      path: filePath,
      hash,
      deduplicated: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
