import { useState, useEffect } from 'react';

interface GeoData {
  city: string | null;
  temp: number | null;
  loading: boolean;
}

export function useGeoCity(): GeoData {
  const [data, setData] = useState<GeoData>({ city: null, temp: null, loading: true });

  useEffect(() => {
    let active = true;

    const normalizeCity = (value: string | null | undefined) => {
      if (!value) return null;
      const trimmed = value.trim().replace(/\s+/g, ' ');
      if (!trimmed) return null;
      const commaParts = trimmed.split(',').map(part => part.trim()).filter(Boolean);
      if (commaParts.length === 2 && commaParts[0].toLowerCase() === commaParts[1].toLowerCase()) {
        return commaParts[0];
      }
      const dashParts = trimmed.split(' - ').map(part => part.trim()).filter(Boolean);
      if (dashParts.length === 2 && dashParts[0].toLowerCase() === dashParts[1].toLowerCase()) {
        return dashParts[0];
      }
      return trimmed;
    };

    const getStored = (key: string) => {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    };

    const setStored = (key: string, value: string) => {
      try {
        sessionStorage.setItem(key, value);
      } catch {}
    };

    const cachedCity = normalizeCity(getStored('geo_city'));
    const cachedTempRaw = getStored('geo_temp');
    const cachedTemp = cachedTempRaw ? Number(cachedTempRaw) : null;

    if (cachedCity) {
      setData({ city: cachedCity, temp: Number.isFinite(cachedTemp) ? cachedTemp : null, loading: true });
    }

    const setSafeData = (city: string | null, temp: number | null) => {
      if (!active || !city) return;
      const normalized = normalizeCity(city);
      if (!normalized) return;
      setStored('geo_city', normalized);
      if (temp !== null && Number.isFinite(temp)) {
        setStored('geo_temp', String(temp));
      }
      setData({ city: normalized, temp: temp !== null && Number.isFinite(temp) ? temp : null, loading: false });
    };

    const setLoadingDone = () => {
      if (!active) return;
      setData(prev => ({ ...prev, loading: false }));
    };

    const fetchJson = async (url: string, timeoutMs = 5000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    };

    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        const weather = await weatherRes.json();
        const temp = weather?.current_weather?.temperature ?? null;
        return typeof temp === 'number' ? temp : null;
      } catch {
        return null;
      }
    };

    const reverseGeocode = async (lat: number, lon: number) => {
      try {
        const data = await fetchJson(
          `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=pt&count=1`
        );
        const result = data?.results?.[0];
        return normalizeCity(result?.city || result?.name || result?.admin1 || result?.administrative_area || null);
      } catch {
        return null;
      }
    };

    const geocodeCity = async (city: string) => {
      try {
        const data = await fetchJson(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt`
        );
        const result = data?.results?.[0];
        if (!result?.latitude || !result?.longitude) return null;
        return { lat: Number(result.latitude), lon: Number(result.longitude) };
      } catch {
        return null;
      }
    };

    const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('geolocation_unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 600000,
      });
    });

    const run = async () => {
      let city = cachedCity || null;
      let temp = Number.isFinite(cachedTemp) ? cachedTemp : null;

      try {
        const position = await getPosition();
        const { latitude, longitude } = position.coords;
        const [geoCity, geoTemp] = await Promise.all([
          reverseGeocode(latitude, longitude),
          fetchWeather(latitude, longitude),
        ]);
        if (geoCity) city = geoCity;
        if (geoTemp !== null) temp = geoTemp;
        if (city) setSafeData(city, temp);
        if (city && temp !== null) return;
      } catch {}

      try {
        const ipData = await fetchJson('https://ipapi.co/json/');
        const ipCity = normalizeCity(ipData?.city);
        const lat = ipData?.latitude ?? ipData?.lat;
        const lon = ipData?.longitude ?? ipData?.lon;
        if (ipCity) city = ipCity;
        if (temp === null && lat && lon) {
          const ipTemp = await fetchWeather(Number(lat), Number(lon));
          if (ipTemp !== null) temp = ipTemp;
        }
        if (city) setSafeData(city, temp);
        if (city && temp !== null) return;
      } catch {}

      try {
        const ipWho = await fetchJson('https://ipwho.is/');
        if (ipWho?.success === false) throw new Error('ipwho_failed');
        const ipCity = normalizeCity(ipWho?.city);
        const lat = ipWho?.latitude;
        const lon = ipWho?.longitude;
        if (ipCity) city = ipCity;
        if (temp === null && lat && lon) {
          const ipTemp = await fetchWeather(Number(lat), Number(lon));
          if (ipTemp !== null) temp = ipTemp;
        }
        if (city) setSafeData(city, temp);
        if (city && temp !== null) return;
      } catch {}

      if (city && temp === null) {
        try {
          const coords = await geocodeCity(city);
          if (coords) {
            const geoTemp = await fetchWeather(coords.lat, coords.lon);
            if (geoTemp !== null) temp = geoTemp;
            setSafeData(city, temp);
          }
        } catch {}
      }

      setLoadingDone();
    };

    run();

    return () => { active = false; };
  }, []);

  return data;
}
