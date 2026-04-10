import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

interface GeoData {
  city: string | null;
  state: string | null;
  temp: number | null;
}

interface GeoStore extends GeoData {
  setCity: (city: string, state?: string) => void;
}

const CITY_KEY = 'geo_city';
const STATE_KEY = 'geo_state';
const TEMP_KEY = 'geo_temp';
const OVERRIDE_KEY = 'geo_override';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
  try { sessionStorage.setItem(key, value); } catch {}
}

// ── Module-level singleton store ──
// Ensures only ONE fetch happens regardless of how many components call useGeoCity

let geoState: GeoData = {
  city: safeGet(CITY_KEY),
  state: safeGet(STATE_KEY),
  temp: (() => { const v = safeGet(TEMP_KEY); return v !== null && Number.isFinite(Number(v)) ? Number(v) : null; })(),
};

let listeners = new Set<() => void>();
let fetchStarted = false;

function notify() {
  listeners.forEach(fn => fn());
}

function setGeoState(patch: Partial<GeoData>) {
  geoState = { ...geoState, ...patch };
  notify();
}

async function fetchGeoFromEdge(): Promise<{ city: string | null; state: string | null; temp: number | null }> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !anonKey) return { city: null, state: null, temp: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${baseUrl}/functions/v1/geo-city-weather`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`geo edge ${res.status}`);
    const data = await res.json();
    return {
      city: typeof data?.city === 'string' ? data.city : null,
      state: typeof data?.state === 'string' ? data.state : null,
      temp: typeof data?.temp === 'number' ? data.temp : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGeoFromIpApi(): Promise<{ city: string | null; state: string | null; lat: number | null; lon: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    if (!r.ok) throw new Error(`ipapi ${r.status}`);
    const d = await r.json();
    return { city: d?.city || null, state: d?.region || null, lat: d?.latitude || null, lon: d?.longitude || null };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGeoFromIpWho(): Promise<{ city: string | null; state: string | null; lat: number | null; lon: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch('https://ipwho.is/', { signal: controller.signal });
    if (!r.ok) throw new Error(`ipwho ${r.status}`);
    const d = await r.json();
    if (!d?.success) throw new Error('ipwho failed');
    return { city: d?.city || null, state: d?.region || null, lat: d?.latitude || null, lon: d?.longitude || null };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTemp(lat: number, lon: number): Promise<number | null> {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.current_weather?.temperature ?? null;
  } catch {
    return null;
  }
}

function startFetchIfNeeded() {
  if (fetchStarted) return;
  const isOverride = safeGet(OVERRIDE_KEY) === 'true';
  if (isOverride && geoState.city) return;
  if (geoState.city && geoState.temp !== null) return;

  fetchStarted = true;

  (async () => {
    // 1) Edge function
    try {
      const edgeGeo = await fetchGeoFromEdge();
      if (edgeGeo?.city) {
        safeSet(CITY_KEY, edgeGeo.city);
        if (edgeGeo.state) safeSet(STATE_KEY, edgeGeo.state);
        if (edgeGeo.temp !== null) safeSet(TEMP_KEY, String(edgeGeo.temp));
        setGeoState(edgeGeo);
        return;
      }
    } catch (e) {
      console.debug('[GeoCity] edge function failed:', e);
    }

    // 2) Client-side fallback APIs
    const apis = [fetchGeoFromIpApi, fetchGeoFromIpWho];
    for (const apiFn of apis) {
      try {
        const result = await apiFn();
        if (result.city) {
          let temp: number | null = geoState.temp;
          if (result.lat && result.lon) {
            temp = await fetchTemp(result.lat, result.lon);
          }
          safeSet(CITY_KEY, result.city);
          if (result.state) safeSet(STATE_KEY, result.state);
          if (temp !== null) safeSet(TEMP_KEY, String(temp));
          setGeoState({ city: result.city, state: result.state, temp });
          return;
        }
      } catch (e) {
        console.debug('[GeoCity] API fallback:', e);
      }
    }
  })();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  startFetchIfNeeded();
  return () => { listeners.delete(cb); };
}

function getSnapshot(): GeoData {
  return geoState;
}

export function useGeoCity(): GeoStore {
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setCity = useCallback((city: string, state?: string) => {
    safeSet(CITY_KEY, city);
    safeSet(OVERRIDE_KEY, 'true');
    if (state) safeSet(STATE_KEY, state);
    setGeoState({ city, state: state || geoState.state });
  }, []);

  return { ...data, setCity };
}
