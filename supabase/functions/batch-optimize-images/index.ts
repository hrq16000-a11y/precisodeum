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

    // Scan avatars bucket (folders = user IDs)
    const { data: avatarFolders } = await supabase.storage.from('avatars').list('', { limit: 200 });
    if (avatarFolders) {
      for (const folder of avatarFolders) {
        if (folder.id !== null) continue; // skip files, we want folders
        const { data: files } = await supabase.storage.from('avatars').list(folder.name, { limit: 10 });
        if (!files) continue;
        for (const f of files) {
          if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
          const meta = f.metadata as any;
          const size = meta?.size || 0;
          if (size > MAX_SIZE) {
            results.push({ bucket: 'avatars', file: `${folder.name}/${f.name}`, sizeKB: Math.round(size / 1024) });
          }
        }
      }
    }

    // Scan service-images bucket (top-level only)
    const { data: serviceFiles } = await supabase.storage.from('service-images').list('', { limit: 200 });
    if (serviceFiles) {
      for (const f of serviceFiles) {
        if (!f.name || f.name === '.emptyFolderPlaceholder' || f.id === null) continue;
        const meta = f.metadata as any;
        const size = meta?.size || 0;
        if (size > MAX_SIZE) {
          results.push({ bucket: 'service-images', file: f.name, sizeKB: Math.round(size / 1024) });
        }
      }
      // Also check sponsors subfolder
      const { data: sponsorFiles } = await supabase.storage.from('service-images').list('sponsors', { limit: 50 });
      if (sponsorFiles) {
        for (const f of sponsorFiles) {
          if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
          const meta = f.metadata as any;
          const size = meta?.size || 0;
          if (size > MAX_SIZE) {
            results.push({ bucket: 'service-images', file: `sponsors/${f.name}`, sizeKB: Math.round(size / 1024) });
          }
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
