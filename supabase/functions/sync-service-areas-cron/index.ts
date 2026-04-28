// Cron job: sincroniza provider.city com services.service_area diariamente.
// Chamado por pg_cron (03:00 no timezone configurado em site_settings).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Lê timezone configurada
    let tz = 'America/Sao_Paulo';
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/site_settings?key=eq.service_area_sync_timezone&select=value`,
        { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
      );
      const j = await r.json();
      if (Array.isArray(j) && j[0]?.value) tz = String(j[0].value).replace(/^"|"$/g, '');
    } catch { /* fallback default */ }

    const dryRun = new URL(req.url).searchParams.get('dry_run') === 'true';

    const rpc = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/admin_sync_provider_city_with_services`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_dry_run: dryRun, p_triggered_by: 'cron_daily', p_timezone: tz }),
      }
    );
    const result = await rpc.json();
    const affected = Array.isArray(result) ? result.length : 0;

    return new Response(
      JSON.stringify({ ok: true, dry_run: dryRun, affected, timezone: tz, ran_at: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
