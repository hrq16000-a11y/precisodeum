import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_BUCKETS = ['service-images', 'avatars', 'portfolio'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // --- Auth: require authenticated user ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bucket = (formData.get('bucket') as string) || 'service-images';
    const folder = (formData.get('folder') as string) || '';

    // --- Bucket allowlist ---
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return new Response(JSON.stringify({ error: 'Invalid bucket' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Path traversal protection ---
    if (folder.includes('..') || folder.includes('//')) {
      return new Response(JSON.stringify({ error: 'Invalid folder path' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large. Max 5MB.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

    const originalName = file.name || 'image';
    const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    const isGif = ext === 'gif';
    const finalExt = isGif ? 'gif' : ext;
    const contentType = isGif ? 'image/gif' : file.type || 'image/jpeg';

    const basePath = folder ? `${folder}/${hash}` : hash;
    const filePath = `${basePath}.${finalExt}`;

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

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, uint8, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: 'Upload failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
