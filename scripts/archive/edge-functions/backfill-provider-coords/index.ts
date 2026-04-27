const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const NOMINATIM_DELAY_MS = 1100; // 1 req/s rate limit

async function geocode(city: string, state: string): Promise<{ lat: number; lon: number } | null> {
  const query = encodeURIComponent(`${city}, ${state}, Brasil`);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${query}`,
      { headers: { 'User-Agent': 'PrecisodeumBackfill/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.[0]?.lat && data?.[0]?.lon) {
      return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validate admin auth
  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Check if admin
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader || '' } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roleData } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Sem permissão' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch providers without coordinates
  const { data: providers, error } = await adminClient
    .from('providers')
    .select('id, city, state')
    .is('latitude', null)
    .is('deleted_at', null)
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!providers || providers.length === 0) {
    return new Response(JSON.stringify({ updated: 0, message: 'Todos os providers já possuem coordenadas' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let updated = 0;
  let failed = 0;

  for (const p of providers) {
    if (!p.city || !p.state) { failed++; continue; }

    const coords = await geocode(p.city, p.state);
    if (coords) {
      const { error: updErr } = await adminClient
        .from('providers')
        .update({ latitude: coords.lat, longitude: coords.lon })
        .eq('id', p.id);
      if (!updErr) updated++;
      else failed++;
    } else {
      failed++;
    }

    await sleep(NOMINATIM_DELAY_MS);
  }

  return new Response(JSON.stringify({ updated, failed, total: providers.length }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
