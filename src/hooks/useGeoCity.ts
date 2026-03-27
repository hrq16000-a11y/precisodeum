import { useState, useEffect } from 'react';

interface GeoData {
  city: string | null;
  temp: number | null;
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

async function fetchGeoFromIpApi2(): Promise<{ city: string | null; lat: number | null; lon: number | null }> {
  const r = await fetch('https://freeipapi.com/api/json');
  if (!r.ok) throw new Error(`freeipapi ${r.status}`);
  const d = await r.json();
  return { city: d?.cityName || null, lat: d?.latitude || null, lon: d?.longitude || null };
}

async function fetchGeoWithFallback() {
  const apis = [fetchGeoFromIpApi, fetchGeoFromIpWho, fetchGeoFromIpApi2];
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
    // Check cache first (sessionStorage)
    const cachedCity = sessionStorage.getItem('geo_city');
    const cachedTemp = sessionStorage.getItem('geo_temp');
    if (cachedCity && cachedTemp) {
      setData({ city: cachedCity, temp: Number(cachedTemp) });
      return;
    }
    if (cachedCity) {
      setData(prev => ({ ...prev, city: cachedCity }));
    }

    let cancelled = false;

    (async () => {
      try {
        const geo = await fetchGeoWithFallback();
        if (cancelled) return;

        const city = geo.city || cachedCity || null;
        let temp: number | null = cachedTemp ? Number(cachedTemp) : null;

        if (geo.lat && geo.lon && temp === null) {
          temp = await fetchTemp(geo.lat, geo.lon);
        }

        if (cancelled) return;

        if (city) {
          sessionStorage.setItem('geo_city', city);
          if (temp !== null) sessionStorage.setItem('geo_temp', String(temp));
          setData({ city, temp });
        }
      } catch (e) {
        console.debug('[GeoCity] Failed:', e);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return data;
}
