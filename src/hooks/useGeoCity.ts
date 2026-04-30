import { useCallback, useSyncExternalStore } from 'react';
import { normalizeUF } from '@/lib/locationFormat';
import { parseReverseGeocodeLocation } from '@/lib/geoReverseGeocode';


interface GeoData {
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  temp: number | null;
  latitude: number | null;
  longitude: number | null;
  precise: boolean;
  manualOverride: boolean;
  radiusKm: number;
  /** Indica que a última tentativa de obter GPS/CEP falhou e estamos usando cache. */
  geoFailed: boolean;
  /** Origem da localização atual (para mostrar avisos contextuais). */
  source: 'gps' | 'ip' | 'manual' | 'cache' | 'none';
  /** Timestamp ISO da última atualização bem-sucedida da localização. */
  lastKnownAt: string | null;
}

interface GeoStore extends GeoData {
  setCity: (city: string, state?: string, latitude?: number | null, longitude?: number | null, neighborhood?: string | null) => void;
  setRadius: (km: number) => void;
  requestPreciseLocation: (options?: { force?: boolean }) => Promise<{ ok: boolean; city: string | null; state: string | null; accuracyMeters?: number | null; neighborhood?: string | null }>;
  /** Limpa o estado de erro (ex.: após o usuário ver o aviso). */
  dismissGeoFailure: () => void;
}

const CITY_KEY = 'geo_city';
const STATE_KEY = 'geo_state';
const NEIGHBORHOOD_KEY = 'geo_neighborhood';
const TEMP_KEY = 'geo_temp';
const LAT_KEY = 'geo_lat';
const LON_KEY = 'geo_lon';
const OVERRIDE_KEY = 'geo_override';
const PRECISE_KEY = 'geo_precise';
const GEO_ASKED_KEY = 'geo_browser_asked';
const RADIUS_KEY = 'geo_radius';
const FETCH_TS_KEY = 'geo_fetch_ts';
const SOURCE_KEY = 'geo_source';
const LAST_KNOWN_KEY = 'geo_last_known_at';
const GEO_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

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

function safeRemove(key: string) {
  try { localStorage.removeItem(key); } catch {}
  try { sessionStorage.removeItem(key); } catch {}
}

function parseNumber(value: string | null) {
  return value !== null && Number.isFinite(Number(value)) ? Number(value) : null;
}

const initialCity = safeGet(CITY_KEY);
const initialLat = parseNumber(safeGet(LAT_KEY));
const initialLon = parseNumber(safeGet(LON_KEY));
const initialOverride = safeGet(OVERRIDE_KEY) === 'true';
const initialPrecise = safeGet(PRECISE_KEY) === 'true';
const storedSource = safeGet(SOURCE_KEY) as GeoData['source'] | null;
const initialSource: GeoData['source'] =
  storedSource ?? (initialOverride ? 'manual' : initialPrecise ? 'gps' : initialCity || initialLat != null ? 'cache' : 'none');

let geoState: GeoData = {
  city: initialCity,
  state: normalizeUF(safeGet(STATE_KEY)),
  neighborhood: safeGet(NEIGHBORHOOD_KEY),
  temp: parseNumber(safeGet(TEMP_KEY)),
  latitude: initialLat,
  longitude: initialLon,
  precise: initialPrecise,
  manualOverride: initialOverride,
  radiusKm: parseNumber(safeGet(RADIUS_KEY)) ?? 50,
  geoFailed: false,
  source: initialSource,
  lastKnownAt: safeGet(LAST_KNOWN_KEY),
};

let listeners = new Set<() => void>();
let fetchStarted = false;
let tempRefreshTimer: ReturnType<typeof setInterval> | null = null;
const TEMP_REFRESH_MS = 15 * 60 * 1000; // 15 min

function notify() {
  listeners.forEach((fn) => fn());
}

function setGeoState(patch: Partial<GeoData>) {
  // Dedup: skip if nothing changed
  const keys = Object.keys(patch) as (keyof GeoData)[];
  const changed = keys.some((k) => patch[k] !== geoState[k]);
  if (!changed) return;
  geoState = { ...geoState, ...patch };
  notify();
}

function startTempRefresh() {
  if (tempRefreshTimer) return;
  tempRefreshTimer = setInterval(async () => {
    if (geoState.latitude === null || geoState.longitude === null) return;
    try {
      const newTemp = await fetchTemp(geoState.latitude, geoState.longitude);
      if (newTemp !== null && newTemp !== geoState.temp) {
        safeSet(TEMP_KEY, String(newTemp));
        setGeoState({ temp: newTemp });
      }
    } catch { /* silent */ }
  }, TEMP_REFRESH_MS);
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
    return parseReverseGeocodeLocation(data);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reverse geocode via Nominatim (OpenStreetMap). Mais preciso para bairros no Brasil
 * que o BigDataCloud. Usado como fallback quando o bairro não veio na primeira tentativa.
 */
async function reverseGeocodeNominatim(latitude: number, longitude: number): Promise<{ city: string | null; state: string | null; neighborhood: string | null } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&accept-language=pt-BR&zoom=18&addressdetails=1`,
      { signal: controller.signal, headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const addr = data?.address || {};
    const neighborhood =
      addr.neighbourhood ||
      addr.suburb ||
      addr.quarter ||
      addr.city_district ||
      addr.residential ||
      addr.hamlet ||
      null;
    const city = addr.city || addr.town || addr.village || addr.municipality || null;
    const state = addr.state_code || addr.state || null;
    return { city, state, neighborhood };
  } catch {
    return null;
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
  if (geoState.city && geoState.temp !== null && geoState.latitude !== null && geoState.longitude !== null) {
    // Check TTL — skip refetch if last fetch was recent
    const lastTs = parseNumber(safeGet(FETCH_TS_KEY));
    if (lastTs && Date.now() - lastTs < GEO_TTL_MS) return;
  }
  if (geoState.manualOverride && geoState.city) return;

  fetchStarted = true;

  // Defer geo fetch well past LCP to break the critical request chain.
  // Use requestIdleCallback (with 8s timeout fallback) so the fetch only fires
  // once the browser is truly idle, keeping it out of Lighthouse's dependency tree.
  const startGeoFetch = () => { (async () => {
    let success = false;
    try {
      const edgeGeo = await fetchGeoFromEdge();
        if (edgeGeo.city || edgeGeo.state || edgeGeo.temp !== null) {
        const uf = normalizeUF(edgeGeo.state);
        if (edgeGeo.city) safeSet(CITY_KEY, edgeGeo.city);
        if (uf) safeSet(STATE_KEY, uf);
          safeRemove(NEIGHBORHOOD_KEY);
        if (edgeGeo.temp !== null) safeSet(TEMP_KEY, String(edgeGeo.temp));
        const now = String(Date.now());
        safeSet(FETCH_TS_KEY, now);
        safeSet(SOURCE_KEY, 'ip');
        safeSet(LAST_KNOWN_KEY, new Date().toISOString());
        setGeoState({ ...edgeGeo, state: uf, source: 'ip', geoFailed: false, lastKnownAt: new Date().toISOString() });
        success = true;
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

        const uf = normalizeUF(result.state);
        if (result.city) safeSet(CITY_KEY, result.city);
        if (uf) safeSet(STATE_KEY, uf);
        safeRemove(NEIGHBORHOOD_KEY);
        if (result.lat !== null) safeSet(LAT_KEY, String(result.lat));
        if (result.lon !== null) safeSet(LON_KEY, String(result.lon));
        if (temp !== null) safeSet(TEMP_KEY, String(temp));
        const ts = new Date().toISOString();
        safeSet(FETCH_TS_KEY, String(Date.now()));
        safeSet(PRECISE_KEY, 'false');
        safeSet(SOURCE_KEY, 'ip');
        safeSet(LAST_KNOWN_KEY, ts);

        setGeoState({
          city: result.city || geoState.city,
          state: uf || geoState.state,
          temp,
          latitude: result.lat,
          longitude: result.lon,
          precise: false,
          source: 'ip',
          geoFailed: false,
          lastKnownAt: ts,
        });
        success = true;
        return;
      } catch (error) {
        console.debug('[GeoCity] API fallback:', error);
      }
    }

    // Todas as fontes falharam — se temos cache (cidade/coords), avisamos via geoFailed.
    if (!success && (geoState.city || geoState.latitude !== null)) {
      setGeoState({ geoFailed: true, source: geoState.source === 'none' ? 'cache' : geoState.source });
      try {
        const { trackGeoEvent } = await import('@/lib/tracking');
        trackGeoEvent('geo_failed', { stage: 'ip_fallback', had_cache: 'true', source: geoState.source });
      } catch { /* noop */ }
    } else if (!success) {
      setGeoState({ geoFailed: true });
      try {
        const { trackGeoEvent } = await import('@/lib/tracking');
        trackGeoEvent('geo_failed', { stage: 'ip_fallback', had_cache: 'false' });
      } catch { /* noop */ }
    }
  })(); };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(startGeoFetch, { timeout: 1200 });
  } else {
    setTimeout(startGeoFetch, 300);
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  startFetchIfNeeded();
  startTempRefresh();
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): GeoData {
  return geoState;
}

export function useGeoCity(): GeoStore {
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setCity = useCallback((city: string, state?: string, latitude?: number | null, longitude?: number | null, neighborhood?: string | null) => {
    const uf = normalizeUF(state) || undefined;
    safeSet(CITY_KEY, city);
    safeSet(OVERRIDE_KEY, 'true');
    if (uf) safeSet(STATE_KEY, uf);
    if (typeof neighborhood === 'string') safeSet(NEIGHBORHOOD_KEY, neighborhood);

    if (latitude !== undefined && latitude !== null) safeSet(LAT_KEY, String(latitude));
    else {
      try { localStorage.removeItem(LAT_KEY); sessionStorage.removeItem(LAT_KEY); } catch {}
    }

    if (longitude !== undefined && longitude !== null) safeSet(LON_KEY, String(longitude));
    else {
      try { localStorage.removeItem(LON_KEY); sessionStorage.removeItem(LON_KEY); } catch {}
    }

    const ts = new Date().toISOString();
    safeSet(SOURCE_KEY, 'manual');
    safeSet(LAST_KNOWN_KEY, ts);
    setGeoState({
      city,
      state: uf || geoState.state,
      neighborhood: typeof neighborhood === 'string' ? neighborhood : geoState.neighborhood,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      manualOverride: true,
      source: 'manual',
      geoFailed: false,
      lastKnownAt: ts,
    });
  }, []);

  const requestPreciseLocation = useCallback(async (options?: { force?: boolean }) => {
    const force = !!options?.force;
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return { ok: false, city: null, state: null, neighborhood: null };
    }
    if (!force && geoState.manualOverride) return { ok: false, city: null, state: null, neighborhood: geoState.neighborhood };
    if (!force && geoState.precise && geoState.latitude !== null && geoState.longitude !== null) {
      return { ok: true, city: geoState.city, state: geoState.state, neighborhood: geoState.neighborhood };
    }

    if (!force) {
      try {
          if (sessionStorage.getItem(GEO_ASKED_KEY)) return { ok: false, city: null, state: null, neighborhood: geoState.neighborhood };
        sessionStorage.setItem(GEO_ASKED_KEY, '1');
      } catch {
        return { ok: false, city: null, state: null, neighborhood: geoState.neighborhood };
      }
    } else {
      // Explicit user-triggered request: clear the once-per-session guard so
      // the navigator prompt (or the cached permission result) runs again.
      try { sessionStorage.removeItem(GEO_ASKED_KEY); } catch {}
    }

    return await new Promise<{ ok: boolean; city: string | null; state: string | null; accuracyMeters?: number | null; neighborhood?: string | null }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          const accuracyMeters = typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null;
          let city = geoState.city;
          let state = geoState.state;
          let temp = geoState.temp;
          let neighborhood: string | null = null;

          try {
            const location = await reverseGeocode(latitude, longitude);
            city = location.city || city;
            state = normalizeUF(location.state) || state;
            neighborhood = location.neighborhood || null;
          } catch {
            // keep existing city/state when reverse geocoding fails
          }

          if (temp === null) {
            temp = await fetchTemp(latitude, longitude);
          }

          if (city) safeSet(CITY_KEY, city);
          if (state) safeSet(STATE_KEY, state);
          if (neighborhood) safeSet(NEIGHBORHOOD_KEY, neighborhood);
          if (temp !== null) safeSet(TEMP_KEY, String(temp));
          safeSet(LAT_KEY, String(latitude));
          safeSet(LON_KEY, String(longitude));
          safeSet(PRECISE_KEY, 'true');
          const ts2 = new Date().toISOString();
          safeSet(SOURCE_KEY, 'gps');
          safeSet(LAST_KNOWN_KEY, ts2);
          try { localStorage.removeItem(OVERRIDE_KEY); sessionStorage.removeItem(OVERRIDE_KEY); } catch {}

          setGeoState({ city, state, neighborhood, temp, latitude, longitude, precise: true, source: 'gps', geoFailed: false, lastKnownAt: ts2, manualOverride: false });
          resolve({ ok: true, city, state, accuracyMeters, neighborhood });
        },
        () => {
          if (geoState.latitude === null && !geoState.city) {
            fetchStarted = false;
            startFetchIfNeeded();
          } else {
            setGeoState({ geoFailed: true, source: geoState.source === 'none' ? 'cache' : geoState.source });
          }
          import('@/lib/tracking').then(({ trackGeoEvent }) => {
            trackGeoEvent('geo_failed', { stage: 'gps', had_cache: geoState.city ? 'true' : 'false' });
          }).catch(() => {});
          resolve({ ok: false, city: null, state: null, accuracyMeters: null, neighborhood: null });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      );
    });
  }, []);

  const setRadius = useCallback((km: number) => {
    safeSet(RADIUS_KEY, String(km));
    setGeoState({ radiusKm: km });
  }, []);

  const dismissGeoFailure = useCallback(() => {
    setGeoState({ geoFailed: false });
  }, []);

  return { ...data, setCity, setRadius, requestPreciseLocation, dismissGeoFailure };
}
