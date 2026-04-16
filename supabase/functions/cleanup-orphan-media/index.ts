import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify admin
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
      }
    } else {
      // Allow cron with secret
      const url = new URL(req.url);
      const cronSecret = url.searchParams.get('secret');
      if (cronSecret !== Deno.env.get('CRON_SECRET')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
    }

    // Find orphans using the DB function
    const { data: orphans, error } = await supabase.rpc('find_orphan_media', { _min_age_hours: 48 });
    if (error) throw error;

    if (!orphans || orphans.length === 0) {
      return new Response(JSON.stringify({ message: 'No orphans found', deleted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let deleted = 0;
    let freedBytes = 0;
    const errors: string[] = [];
    const BUCKETS = ['avatars', 'service-images', 'portfolio', 'sponsors'];

    for (const orphan of orphans) {
      try {
        // Determine bucket from storage_path
        const pathParts = orphan.storage_path?.split('/') || [];
        const bucket = pathParts[0] || '';
        const filePath = pathParts.slice(1).join('/');

        if (BUCKETS.includes(bucket) && filePath) {
          await supabase.storage.from(bucket).remove([filePath]);
        }

        // Deactivate media record
        await supabase.from('media').update({ is_active: false }).eq('id', orphan.id);
        deleted++;
        freedBytes += orphan.size_bytes || 0;
      } catch (e) {
        errors.push(`${orphan.id}: ${e.message}`);
      }
    }

    const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);

    return new Response(JSON.stringify({
      message: `Cleanup complete`,
      found: orphans.length,
      deleted,
      freed_mb: freedMB,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
