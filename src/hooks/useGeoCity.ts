import { useCallback, useSyncExternalStore } from 'react';

interface GeoData {
  city: string | null;
  state: string | null;
  temp: number | null;
  latitude: number | null;
  longitude: number | null;
  precise: boolean;
  manualOverride: boolean;
  radiusKm: number;
}

interface GeoStore extends GeoData {
  setCity: (city: string, state?: string, latitude?: number | null, longitude?: number | null) => void;
  setRadius: (km: number) => void;
  requestPreciseLocation: () => Promise<boolean>;
}

const CITY_KEY = 'geo_city';
const STATE_KEY = 'geo_state';
const TEMP_KEY = 'geo_temp';
const LAT_KEY = 'geo_lat';
const LON_KEY = 'geo_lon';
const OVERRIDE_KEY = 'geo_override';
const PRECISE_KEY = 'geo_precise';
const GEO_ASKED_KEY = 'geo_browser_asked';
const RADIUS_KEY = 'geo_radius';

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

function parseNumber(value: string | null) {
  return value !== null && Number.isFinite(Number(value)) ? Number(value) : null;
}

let geoState: GeoData = {
  city: safeGet(CITY_KEY),
  state: safeGet(STATE_KEY),
  temp: parseNumber(safeGet(TEMP_KEY)),
  latitude: parseNumber(safeGet(LAT_KEY)),
  longitude: parseNumber(safeGet(LON_KEY)),
  precise: safeGet(PRECISE_KEY) === 'true',
  manualOverride: safeGet(OVERRIDE_KEY) === 'true',
  radiusKm: parseNumber(safeGet(RADIUS_KEY)) ?? 50,
};

let listeners = new Set<() => void>();
let fetchStarted = false;

function notify() {
  listeners.forEach((fn) => fn());
}

function setGeoState(patch: Partial<GeoData>) {
  geoState = { ...geoState, ...patch };
  notify();
}

async function reverseGeocode(latitude: number, longitude: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`,
      { signal: controller.signal }
    );
    if (!response.ok) throw new Error(`reverse-geocode ${response.status}`);
    const data = await response.json();
    return {
      city: data?.city || data?.locality || null,
      state: data?.principalSubdivision || null,
    };
  } finally {
    clearTimeout(timeout);
  }
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

async function fetchTemp(latitude: number, longitude: number): Promise<number | null> {
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.current_weather?.temperature ?? null;
  } catch {
    return null;
  }
}

function startFetchIfNeeded() {
  if (fetchStarted) return;
  if (geoState.manualOverride && geoState.city) return;
  if (geoState.city && geoState.temp !== null && geoState.latitude !== null && geoState.longitude !== null) return;

  fetchStarted = true;

  (async () => {
    try {
      const edgeGeo = await fetchGeoFromEdge();
      if (edgeGeo.city || edgeGeo.state || edgeGeo.temp !== null) {
        if (edgeGeo.city) safeSet(CITY_KEY, edgeGeo.city);
        if (edgeGeo.state) safeSet(STATE_KEY, edgeGeo.state);
        if (edgeGeo.temp !== null) safeSet(TEMP_KEY, String(edgeGeo.temp));
        setGeoState(edgeGeo);
      }
    } catch (error) {
      console.debug('[GeoCity] edge function failed:', error);
    }

    if (geoState.latitude !== null && geoState.longitude !== null) return;

    const apis = [fetchGeoFromIpApi, fetchGeoFromIpWho];
    for (const apiFn of apis) {
      try {
        const result = await apiFn();
        if (!result.city && (result.lat === null || result.lon === null)) continue;

        const temp = result.lat !== null && result.lon !== null
          ? await fetchTemp(result.lat, result.lon)
          : geoState.temp;

        if (result.city) safeSet(CITY_KEY, result.city);
        if (result.state) safeSet(STATE_KEY, result.state);
        if (result.lat !== null) safeSet(LAT_KEY, String(result.lat));
        if (result.lon !== null) safeSet(LON_KEY, String(result.lon));
        if (temp !== null) safeSet(TEMP_KEY, String(temp));
        safeSet(PRECISE_KEY, 'false');

        setGeoState({
          city: result.city || geoState.city,
          state: result.state || geoState.state,
          temp,
          latitude: result.lat,
          longitude: result.lon,
          precise: false,
        });
        return;
      } catch (error) {
        console.debug('[GeoCity] API fallback:', error);
      }
    }
  })();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  startFetchIfNeeded();
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): GeoData {
  return geoState;
}

export function useGeoCity(): GeoStore {
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setCity = useCallback((city: string, state?: string, latitude?: number | null, longitude?: number | null) => {
    safeSet(CITY_KEY, city);
    safeSet(OVERRIDE_KEY, 'true');
    if (state) safeSet(STATE_KEY, state);

    if (latitude !== undefined && latitude !== null) safeSet(LAT_KEY, String(latitude));
    else {
      try { localStorage.removeItem(LAT_KEY); sessionStorage.removeItem(LAT_KEY); } catch {}
    }

    if (longitude !== undefined && longitude !== null) safeSet(LON_KEY, String(longitude));
    else {
      try { localStorage.removeItem(LON_KEY); sessionStorage.removeItem(LON_KEY); } catch {}
    }

    setGeoState({
      city,
      state: state || geoState.state,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      manualOverride: true,
    });
  }, []);

  const requestPreciseLocation = useCallback(async () => {
    if (geoState.manualOverride || typeof window === 'undefined' || !navigator.geolocation) return false;
    if (geoState.precise && geoState.latitude !== null && geoState.longitude !== null) return true;

    try {
      if (sessionStorage.getItem(GEO_ASKED_KEY)) return false;
      sessionStorage.setItem(GEO_ASKED_KEY, '1');
    } catch {
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          let city = geoState.city;
          let state = geoState.state;
          let temp = geoState.temp;

          try {
            const location = await reverseGeocode(latitude, longitude);
            city = location.city || city;
            state = location.state || state;
          } catch {
            // keep existing city/state when reverse geocoding fails
          }

          if (temp === null) {
            temp = await fetchTemp(latitude, longitude);
          }

          if (city) safeSet(CITY_KEY, city);
          if (state) safeSet(STATE_KEY, state);
          if (temp !== null) safeSet(TEMP_KEY, String(temp));
          safeSet(LAT_KEY, String(latitude));
          safeSet(LON_KEY, String(longitude));
          safeSet(PRECISE_KEY, 'true');

          setGeoState({ city, state, temp, latitude, longitude, precise: true });
          resolve(true);
        },
        () => resolve(false),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      );
    });
  }, []);

  const setRadius = useCallback((km: number) => {
    safeSet(RADIUS_KEY, String(km));
    setGeoState({ radiusKm: km });
  }, []);

  return { ...data, setCity, setRadius, requestPreciseLocation };
}
