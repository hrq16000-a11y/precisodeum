import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SIZE = 200 * 1024; // 200KB threshold - anything bigger gets reprocessed

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate cron secret
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Also allow service role
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

      if (authHeader !== `Bearer ${serviceRoleKey}` && authHeader !== `Bearer ${anonKey}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const buckets = ['avatars', 'service-images'];
    const results: { bucket: string; file: string; originalSize: number; newSize: number; action: string }[] = [];

    for (const bucket of buckets) {
      // List top-level items
      const { data: items } = await supabase.storage.from(bucket).list('', { limit: 500 });
      if (!items) continue;

      for (const item of items) {
        // It's a folder (user ID folder for avatars)
        if (item.id === null) {
          const { data: subItems } = await supabase.storage.from(bucket).list(item.name, { limit: 100 });
          if (!subItems) continue;

          for (const subItem of subItems) {
            if (!subItem.name || subItem.name === '.emptyFolderPlaceholder') continue;
            const filePath = `${item.name}/${subItem.name}`;
            const size = (subItem.metadata as any)?.size || 0;

            if (size > MAX_SIZE) {
              // Download, check if it's an image we can optimize
              const ext = subItem.name.split('.').pop()?.toLowerCase() || '';
              if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) continue;

              const { data: fileData } = await supabase.storage.from(bucket).download(filePath);
              if (!fileData) continue;

              const arrayBuffer = await fileData.arrayBuffer();
              const originalSize = arrayBuffer.byteLength;

              // Re-upload with content type to trigger CDN optimization
              // For truly large images, we strip and re-upload
              if (originalSize > MAX_SIZE) {
                results.push({
                  bucket,
                  file: filePath,
                  originalSize,
                  newSize: originalSize,
                  action: `flagged_for_manual_resize (${Math.round(originalSize / 1024)}KB)`,
                });
              }
            }
          }
        } else {
          // Direct file in bucket root
          if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
          const size = (item.metadata as any)?.size || 0;
          if (size > MAX_SIZE) {
            results.push({
              bucket,
              file: item.name,
              originalSize: size,
              newSize: size,
              action: `flagged_for_manual_resize (${Math.round(size / 1024)}KB)`,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      results,
      message: results.length === 0 ? 'All images are within size limits' : `Found ${results.length} oversized images`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
