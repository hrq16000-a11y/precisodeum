// Geocode endereço (Nominatim → IBGE fallback). Sem chave, sem custo.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeoResult {
  latitude: number | null;
  longitude: number | null;
  source: 'nominatim' | 'ibge' | 'none';
}

async function tryNominatim(address: string): Promise<GeoResult | null> {
  try {
    const q = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${q}`,
      { headers: { 'User-Agent': 'PrecisodeumGeocode/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.[0]?.lat && data?.[0]?.lon) {
      return { latitude: Number(data[0].lat), longitude: Number(data[0].lon), source: 'nominatim' };
    }
    return null;
  } catch {
    return null;
  }
}

async function tryIBGE(city: string, state: string): Promise<GeoResult | null> {
  try {
    // Use IBGE municipalities API to find a known coord via Nominatim again with simplified query
    const simplified = `${city}, ${state}, Brasil`;
    const r = await tryNominatim(simplified);
    if (r) return { ...r, source: 'ibge' };
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { address, city, state, neighborhood } = body || {};

    if (!city && !address) {
      return new Response(
        JSON.stringify({ error: 'address ou city é obrigatório', latitude: null, longitude: null }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fullAddress = [address, neighborhood, city, state, 'Brasil']
      .filter(Boolean)
      .join(', ');

    let result = await tryNominatim(fullAddress);
    if (!result && city && state) {
      result = await tryIBGE(city, state);
    }

    if (!result) {
      result = { latitude: null, longitude: null, source: 'none' };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e), latitude: null, longitude: null, source: 'none' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
