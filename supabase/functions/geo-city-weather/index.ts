const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type GeoResult = {
  city: string | null;
  lat: number | null;
  lon: number | null;
};

function getClientIp(req: Request): string | null {
  const header =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    '';

  const first = header.split(',')[0]?.trim();
  return first || null;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function geoFromIpApi(ip: string | null): Promise<GeoResult> {
  const endpoint = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
  const res = await fetchWithTimeout(endpoint);
  if (!res.ok) throw new Error(`ipapi ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error('ipapi error');

  return {
    city: data?.city || null,
    lat: typeof data?.latitude === 'number' ? data.latitude : null,
    lon: typeof data?.longitude === 'number' ? data.longitude : null,
  };
}

async function geoFromIpWho(ip: string | null): Promise<GeoResult> {
  const endpoint = ip ? `https://ipwho.is/${ip}` : 'https://ipwho.is/';
  const res = await fetchWithTimeout(endpoint);
  if (!res.ok) throw new Error(`ipwho ${res.status}`);
  const data = await res.json();
  if (!data?.success) throw new Error('ipwho error');

  return {
    city: data?.city || null,
    lat: typeof data?.latitude === 'number' ? data.latitude : null,
    lon: typeof data?.longitude === 'number' ? data.longitude : null,
  };
}

async function geoFromFreeIpApi(ip: string | null): Promise<GeoResult> {
  const endpoint = ip ? `https://freeipapi.com/api/json/${ip}` : 'https://freeipapi.com/api/json';
  const res = await fetchWithTimeout(endpoint);
  if (!res.ok) throw new Error(`freeipapi ${res.status}`);
  const data = await res.json();

  return {
    city: data?.cityName || null,
    lat: typeof data?.latitude === 'number' ? data.latitude : null,
    lon: typeof data?.longitude === 'number' ? data.longitude : null,
  };
}

async function fetchGeo(ip: string | null): Promise<GeoResult> {
  const providers = [geoFromIpApi, geoFromIpWho, geoFromFreeIpApi];

  for (const provider of providers) {
    try {
      const result = await provider(ip);
      if (result.city) return result;
    } catch {
      // silent fallback
    }
  }

  return { city: null, lat: null, lon: null };
}

async function fetchTemp(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.current_weather?.temperature === 'number'
      ? data.current_weather.temperature
      : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clientIp = getClientIp(req);
    const geo = await fetchGeo(clientIp);

    let temp: number | null = null;
    if (geo.lat !== null && geo.lon !== null) {
      temp = await fetchTemp(geo.lat, geo.lon);
    }

    return new Response(
      JSON.stringify({
        city: geo.city,
        temp,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch {
    return new Response(JSON.stringify({ city: null, temp: null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
