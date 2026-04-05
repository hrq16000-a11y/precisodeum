import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SIZE = 200 * 1024; // 200KB

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results: { bucket: string; file: string; sizeKB: number }[] = [];

    // Scan a single folder level (no recursion to avoid timeouts)
    const scanFolder = async (bucket: string, folder: string) => {
      const { data: files } = await supabase.storage.from(bucket).list(folder || undefined, { limit: 500 });
      if (!files) return;
      for (const f of files) {
        if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
        const meta = f.metadata as any;
        const size = meta?.size || 0;
        const filePath = folder ? `${folder}/${f.name}` : f.name;
        if (size > MAX_SIZE) {
          results.push({ bucket, file: filePath, sizeKB: Math.round(size / 1024) });
        }
      }
    };

    // Scan top-level of each bucket
    const buckets = ['avatars', 'service-images', 'portfolio'];
    for (const bucket of buckets) {
      // List top-level entries
      const { data: topLevel } = await supabase.storage.from(bucket).list('', { limit: 500 });
      if (!topLevel) continue;

      for (const entry of topLevel) {
        if (!entry.name || entry.name === '.emptyFolderPlaceholder') continue;
        const meta = entry.metadata as any;
        const size = meta?.size || 0;

        if (size > 0) {
          // It's a file
          if (size > MAX_SIZE) {
            results.push({ bucket, file: entry.name, sizeKB: Math.round(size / 1024) });
          }
        } else {
          // It's a folder — scan one level deep
          await scanFolder(bucket, entry.name);
        }
      }
    }

    // Sort by size descending
    results.sort((a, b) => b.sizeKB - a.sizeKB);

    const totalWastedKB = results.reduce((sum, r) => sum + r.sizeKB, 0);

    return new Response(JSON.stringify({
      oversized_count: results.length,
      total_wasted_kb: totalWastedKB,
      threshold_kb: Math.round(MAX_SIZE / 1024),
      files: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
