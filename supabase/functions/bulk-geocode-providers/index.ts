// Bulk geocoding for all providers missing coordinates.
// Uses Nominatim (1 req/s) with IBGE fallback. Admin-only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOMINATIM_DELAY_MS = 1100; // respect 1 req/s
const BATCH_LIMIT = 500;          // safety cap per invocation

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocodeNominatim(city: string, state: string, neighborhood?: string | null) {
  const parts = [neighborhood, city, state, 'Brasil'].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(parts)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'PrecisodeumBulkGeocode/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.[0]?.lat && data?.[0]?.lon) {
      return { lat: Number(data[0].lat), lon: Number(data[0].lon), source: 'nominatim' as const };
    }
  } catch { /* swallow */ }
  return null;
}

async function geocodeIBGE(city: string, state: string) {
  // IBGE: lookup municipality centroid via API
  try {
    const ufRes = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`);
    if (!ufRes.ok) return null;
    const munis = await ufRes.json();
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const target = norm(city);
    const m = (munis as any[]).find((x) => norm(x.nome) === target);
    if (!m) return null;
    // IBGE doesn't expose centroid directly via /municipios; fall back to a second Nominatim
    // structured query as last resort using municipality name only
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&city=${encodeURIComponent(m.nome)}&state=${encodeURIComponent(state)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'PrecisodeumBulkGeocode/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.[0]?.lat && data?.[0]?.lon) {
      return { lat: Number(data[0].lat), lon: Number(data[0].lon), source: 'ibge' as const };
    }
  } catch { /* swallow */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Validate admin
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleData } = await admin
    .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: 'Sem permissão' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Find providers without valid coords AND with usable city/state
  const { data: providers, error } = await admin
    .from('providers')
    .select('id, city, state, neighborhood, latitude, longitude')
    .is('deleted_at', null)
    .or('latitude.is.null,longitude.is.null,latitude.eq.0,longitude.eq.0')
    .not('city', 'is', null)
    .neq('city', '')
    .neq('city', 'Não informada')
    .not('state', 'is', null)
    .neq('state', '')
    .limit(BATCH_LIMIT);

  // Count separately how many were skipped due to missing address
  const { count: skippedCount } = await admin
    .from('providers')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .or('latitude.is.null,longitude.is.null,latitude.eq.0,longitude.eq.0')
    .or('city.is.null,city.eq.,city.eq.Não informada,state.is.null,state.eq.');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!providers || providers.length === 0) {
    return new Response(JSON.stringify({ updated: 0, total: 0, message: 'Todos os prestadores já possuem coordenadas' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let updated = 0;
  let failed = 0;
  let nominatim_hits = 0;
  let ibge_hits = 0;

  for (const p of providers) {
    if (!p.city || !p.state) { failed++; continue; }

    let coords = await geocodeNominatim(p.city, p.state, p.neighborhood);
    if (coords) nominatim_hits++;

    if (!coords) {
      await sleep(NOMINATIM_DELAY_MS); // respect rate limit before second call
      coords = await geocodeIBGE(p.city, p.state);
      if (coords) ibge_hits++;
    }

    if (coords) {
      const { error: updErr } = await admin
        .from('providers')
        .update({ latitude: coords.lat, longitude: coords.lon })
        .eq('id', p.id);
      if (updErr) failed++; else updated++;
    } else {
      failed++;
    }

    await sleep(NOMINATIM_DELAY_MS); // 1 req/s
  }

  return new Response(JSON.stringify({
    total: providers.length, updated, failed, nominatim_hits, ibge_hits,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
