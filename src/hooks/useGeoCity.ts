import { useState, useEffect } from 'react';

interface GeoData {
  city: string | null;
  temp: number | null;
}

const CITY_KEY = 'geo_city';
const TEMP_KEY = 'geo_temp';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

async function fetchGeoFromEdge(): Promise<GeoData | null> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!baseUrl || !anonKey) return null;

  const res = await fetch(`${baseUrl}/functions/v1/geo-city-weather`, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`geo edge ${res.status}`);
  const data = await res.json();

  return {
    city: typeof data?.city === 'string' ? data.city : null,
    temp: typeof data?.temp === 'number' ? data.temp : null,
  };
}

async function fetchGeoFromIpApi(): Promise<{ city: string | null; lat: number | null; lon: number | null }> {
  const r = await fetch('https://ipapi.co/json/');
  if (!r.ok) throw new Error(`ipapi ${r.status}`);
  const d = await r.json();
  return { city: d?.city || null, lat: d?.latitude || null, lon: d?.longitude || null };
}

async function fetchGeoFromIpWho(): Promise<{ city: string | null; lat: number | null; lon: number | null }> {
  const r = await fetch('https://ipwho.is/');
  if (!r.ok) throw new Error(`ipwho ${r.status}`);
  const d = await r.json();
  if (!d?.success) throw new Error('ipwho failed');
  return { city: d?.city || null, lat: d?.latitude || null, lon: d?.longitude || null };
}

async function fetchGeoFromFreeIpApi(): Promise<{ city: string | null; lat: number | null; lon: number | null }> {
  const r = await fetch('https://freeipapi.com/api/json');
  if (!r.ok) throw new Error(`freeipapi ${r.status}`);
  const d = await r.json();
  return { city: d?.cityName || null, lat: d?.latitude || null, lon: d?.longitude || null };
}

async function fetchGeoWithFallback() {
  const apis = [fetchGeoFromIpApi, fetchGeoFromIpWho, fetchGeoFromFreeIpApi];
  for (const apiFn of apis) {
    try {
      const result = await apiFn();
      if (result.city) return result;
    } catch (e) {
      console.debug('[GeoCity] API fallback:', e);
    }
  }
  return { city: null, lat: null, lon: null };
}

async function fetchTemp(lat: number, lon: number): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d?.current_weather?.temperature ?? null;
  } catch {
    return null;
  }
}

export function useGeoCity(): GeoData {
  const [data, setData] = useState<GeoData>({ city: null, temp: null });

  useEffect(() => {
    const cachedCity = safeGet(CITY_KEY);
    const cachedTempRaw = safeGet(TEMP_KEY);
    const parsedTemp = cachedTempRaw !== null ? Number(cachedTempRaw) : null;
    const cachedTemp = parsedTemp !== null && Number.isFinite(parsedTemp) ? parsedTemp : null;

    if (cachedCity && cachedTemp !== null) {
      setData({ city: cachedCity, temp: cachedTemp });
      return;
    }

    if (cachedCity) {
      setData({ city: cachedCity, temp: cachedTemp });
    }

    let cancelled = false;

    (async () => {
      // 1) Try client-side APIs first (correct user IP)
      try {
        const geo = await fetchGeoWithFallback();
        if (!cancelled && geo.city) {
          let temp: number | null = cachedTemp;
          if (geo.lat && geo.lon) {
            temp = await fetchTemp(geo.lat, geo.lon);
          }
          if (!cancelled) {
            safeSet(CITY_KEY, geo.city);
            if (temp !== null) safeSet(TEMP_KEY, String(temp));
            setData({ city: geo.city, temp });
            return;
          }
        }
      } catch (e) {
        console.debug('[GeoCity] client APIs failed:', e);
      }

      // 2) Fallback to edge function (uses server IP - less accurate)
      try {
        const edgeGeo = await fetchGeoFromEdge();
        if (!cancelled && edgeGeo?.city) {
          safeSet(CITY_KEY, edgeGeo.city);
          if (edgeGeo.temp !== null) safeSet(TEMP_KEY, String(edgeGeo.temp));
          setData({ city: edgeGeo.city, temp: edgeGeo.temp });
        }
      } catch (e) {
        console.debug('[GeoCity] edge fallback failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
