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

    // Autorização: admin via has_role() (NUNCA profiles.role, que é mutável pelo usuário)
    // ou cron com CRON_SECRET via query string.
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      // Verificação segura via security-definer function has_role()
      const { data: isAdmin, error: roleErr } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      });
      if (roleErr || isAdmin !== true) {
        return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
      }
    } else {
      // Cron call: secret only via header (URL query strings leak in access logs)
      const cronSecret = req.headers.get('x-cron-secret');
      if (!cronSecret || cronSecret !== Deno.env.get('CRON_SECRET')) {
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
        const pathParts = orphan.storage_path?.split('/') || [];
        const bucket = pathParts[0] || '';
        const filePath = pathParts.slice(1).join('/');

        if (BUCKETS.includes(bucket) && filePath) {
          await supabase.storage.from(bucket).remove([filePath]);
        }

        await supabase.from('media').update({ is_active: false }).eq('id', orphan.id);
        deleted++;
        freedBytes += orphan.size_bytes || 0;
      } catch (e) {
        errors.push(`${orphan.id}: ${(e as Error).message}`);
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
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
