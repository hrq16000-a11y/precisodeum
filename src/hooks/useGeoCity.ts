import { useState, useEffect, useCallback } from 'react';

interface GeoData {
  city: string | null;
  state: string | null;
  temp: number | null;
  setCity: (city: string, state?: string) => void;
}

const CITY_KEY = 'geo_city';
const STATE_KEY = 'geo_state';
const TEMP_KEY = 'geo_temp';
const OVERRIDE_KEY = 'geo_override'; // user manually changed city

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

async function fetchGeoFromEdge(): Promise<{ city: string | null; state: string | null; temp: number | null }> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!baseUrl || !anonKey) return { city: null, state: null, temp: null };

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
    state: typeof data?.state === 'string' ? data.state : null,
    temp: typeof data?.temp === 'number' ? data.temp : null,
  };
}

async function fetchGeoFromIpApi(): Promise<{ city: string | null; state: string | null; lat: number | null; lon: number | null }> {
  const r = await fetch('https://ipapi.co/json/');
  if (!r.ok) throw new Error(`ipapi ${r.status}`);
  const d = await r.json();
  return { city: d?.city || null, state: d?.region || null, lat: d?.latitude || null, lon: d?.longitude || null };
}

async function fetchGeoFromIpWho(): Promise<{ city: string | null; state: string | null; lat: number | null; lon: number | null }> {
  const r = await fetch('https://ipwho.is/');
  if (!r.ok) throw new Error(`ipwho ${r.status}`);
  const d = await r.json();
  if (!d?.success) throw new Error('ipwho failed');
  return { city: d?.city || null, state: d?.region || null, lat: d?.latitude || null, lon: d?.longitude || null };
}

async function fetchGeoFromFreeIpApi(): Promise<{ city: string | null; state: string | null; lat: number | null; lon: number | null }> {
  const r = await fetch('https://freeipapi.com/api/json');
  if (!r.ok) throw new Error(`freeipapi ${r.status}`);
  const d = await r.json();
  return { city: d?.cityName || null, state: d?.regionName || null, lat: d?.latitude || null, lon: d?.longitude || null };
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
  return { city: null, state: null, lat: null, lon: null };
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
  const [data, setData] = useState<{ city: string | null; state: string | null; temp: number | null }>({
    city: null,
    state: null,
    temp: null,
  });

  const setCity = useCallback((city: string, state?: string) => {
    safeSet(CITY_KEY, city);
    safeSet(OVERRIDE_KEY, 'true');
    if (state) safeSet(STATE_KEY, state);
    setData((prev) => ({ ...prev, city, state: state || prev.state }));
  }, []);

  useEffect(() => {
    const cachedCity = safeGet(CITY_KEY);
    const cachedState = safeGet(STATE_KEY);
    const cachedTempRaw = safeGet(TEMP_KEY);
    const parsedTemp = cachedTempRaw !== null ? Number(cachedTempRaw) : null;
    const cachedTemp = parsedTemp !== null && Number.isFinite(parsedTemp) ? parsedTemp : null;
    const isOverride = safeGet(OVERRIDE_KEY) === 'true';

    if (cachedCity && cachedTemp !== null) {
      setData({ city: cachedCity, state: cachedState, temp: cachedTemp });
      if (isOverride) return; // user overrode, don't re-fetch
    }

    if (cachedCity) {
      setData({ city: cachedCity, state: cachedState, temp: cachedTemp });
      if (isOverride) return;
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
            if (geo.state) safeSet(STATE_KEY, geo.state);
            if (temp !== null) safeSet(TEMP_KEY, String(temp));
            setData({ city: geo.city, state: geo.state, temp });
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
          if (edgeGeo.state) safeSet(STATE_KEY, edgeGeo.state);
          if (edgeGeo.temp !== null) safeSet(TEMP_KEY, String(edgeGeo.temp));
          setData({ city: edgeGeo.city, state: edgeGeo.state, temp: edgeGeo.temp });
        }
      } catch (e) {
        console.debug('[GeoCity] edge fallback failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, setCity };
}
