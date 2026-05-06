import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKETS = ['avatars', 'service-images', 'portfolio'];
const SCAN_LIMIT = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all existing storage_path from media table
    const { data: existingMedia } = await supabase
      .from('media')
      .select('storage_path, public_url');

    const existingPaths = new Set(
      (existingMedia || []).map((m: any) => m.storage_path).filter(Boolean)
    );
    const existingUrls = new Set(
      (existingMedia || []).map((m: any) => m.public_url).filter(Boolean)
    );

    const newEntries: any[] = [];

    const scanFolder = async (bucket: string, folder: string) => {
      let offset = 0;
      while (true) {
        const { data: files } = await supabase.storage
          .from(bucket)
          .list(folder || undefined, { limit: SCAN_LIMIT, offset });

        if (!files || files.length === 0) break;

        for (const f of files) {
          if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
          const meta = f.metadata as any;
          const filePath = folder ? `${folder}/${f.name}` : f.name;
          const storagePath = `${bucket}/${filePath}`;

          // Check if it's a file (has metadata/mimetype) or a folder
          const isFile = !!(meta?.mimetype || meta?.size);
          
          if (!isFile) {
            // It's a subfolder, recurse
            await scanFolder(bucket, filePath);
            continue;
          }

          // Build public URL
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          const publicUrl = urlData?.publicUrl || '';

          // Skip if already tracked
          if (existingPaths.has(storagePath) || existingUrls.has(publicUrl)) continue;

          const mimeType = meta?.mimetype || 'application/octet-stream';
          const size = meta?.size || 0;

          // Determine entity_type from bucket
          let entityType = 'generic';
          if (bucket === 'avatars') entityType = 'profile';
          else if (bucket === 'service-images') entityType = 'service';
          else if (bucket === 'portfolio') entityType = 'portfolio';

          // Extract user_ref from folder structure if possible
          let userRef: string | null = null;
          const parts = filePath.split('/');
          if (parts.length > 1) {
            // Folder name might be user_ref
            userRef = parts[0];
          }

          newEntries.push({
            storage_path: storagePath,
            public_url: publicUrl,
            original_name: f.name,
            mime_type: mimeType,
            entity_type: entityType,
            size_original: size,
            is_active: true,
            user_ref: userRef,
          });
        }

        if (files.length < SCAN_LIMIT) break;
        offset += SCAN_LIMIT;
      }
    };

    for (const bucket of BUCKETS) {
      await scanFolder(bucket, '');
    }

    // Batch insert
    let inserted = 0;
    if (newEntries.length > 0) {
      // Insert in chunks of 500
      for (let i = 0; i < newEntries.length; i += 500) {
        const chunk = newEntries.slice(i, i + 500);
        const { error } = await supabase.from('media').insert(chunk);
        if (!error) inserted += chunk.length;
        else console.error('Insert error:', error.message);
      }
    }

    return new Response(JSON.stringify({
      scanned_buckets: BUCKETS,
      existing_tracked: existingPaths.size,
      new_files_found: newEntries.length,
      inserted,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
