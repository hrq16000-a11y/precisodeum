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

    // Helper to scan a bucket's folder recursively (one level)
    const scanFolder = async (bucket: string, folder: string) => {
      const { data: files } = await supabase.storage.from(bucket).list(folder || undefined, { limit: 200 });
      if (!files) return;
      for (const f of files) {
        if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
        const meta = f.metadata as any;
        const size = meta?.size || 0;
        const filePath = folder ? `${folder}/${f.name}` : f.name;
        if (size > MAX_SIZE) {
          results.push({ bucket, file: filePath, sizeKB: Math.round(size / 1024) });
        }
        // If it's a folder (no metadata/size), scan inside it
        if (f.id === null || (!meta?.size && !meta?.mimetype)) {
          await scanFolder(bucket, filePath);
        }
      }
    };

    // Scan all relevant buckets
    for (const bucket of ['avatars', 'service-images', 'portfolio']) {
      await scanFolder(bucket, '');
    }

    // Also check sponsors subfolder explicitly
    const { data: sponsorFiles } = await supabase.storage.from('service-images').list('sponsors', { limit: 50 });
    if (sponsorFiles) {
      for (const f of sponsorFiles) {
        if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
        const meta = f.metadata as any;
        const size = meta?.size || 0;
        if (size > MAX_SIZE && !results.find(r => r.bucket === 'service-images' && r.file === `sponsors/${f.name}`)) {
          results.push({ bucket: 'service-images', file: `sponsors/${f.name}`, sizeKB: Math.round(size / 1024) });
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
