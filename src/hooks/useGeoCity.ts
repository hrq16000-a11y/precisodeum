import { useState, useEffect } from 'react';

interface GeoData {
  city: string | null;
  temp: number | null;
}

export function useGeoCity(): GeoData {
  const [data, setData] = useState<GeoData>({ city: null, temp: null });

  useEffect(() => {
    const cachedCity = sessionStorage.getItem('geo_city');
    const cachedTemp = sessionStorage.getItem('geo_temp');

    // If we have both cached, use them
    if (cachedCity && cachedTemp) {
      setData({ city: cachedCity, temp: Number(cachedTemp) });
      return;
    }

    // If city cached but no temp, fetch temp only
    if (cachedCity) {
      setData(prev => ({ ...prev, city: cachedCity }));
      fetchTemp(cachedCity);
      return;
    }

    // Full fetch: city + temp
    fetchCityAndTemp();

    async function fetchTemp(cityName: string) {
      try {
        // Use geocoding to get lat/lon from city name
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=pt`
        );
        const geoData = await geoRes.json();
        const result = geoData?.results?.[0];
        if (!result) return;

        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current_weather=true`
        );
        const weather = await weatherRes.json();
        const temp = weather?.current_weather?.temperature ?? null;
        if (temp !== null) {
          sessionStorage.setItem('geo_temp', String(temp));
          setData(prev => ({ ...prev, temp }));
        }
      } catch {}
    }

    async function fetchCityAndTemp() {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const d = await res.json();
        const city = d?.city || null;
        const lat = d?.latitude;
        const lon = d?.longitude;

        if (!city) return;
        sessionStorage.setItem('geo_city', city);
        setData(prev => ({ ...prev, city }));

        // Fetch temperature
        let temp: number | null = null;
        if (lat && lon) {
          try {
            const weatherRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
            );
            const weather = await weatherRes.json();
            temp = weather?.current_weather?.temperature ?? null;
          } catch {}
        }

        // Fallback: use geocoding API if lat/lon not available
        if (temp === null) {
          try {
            const geoRes = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt`
            );
            const geoData = await geoRes.json();
            const result = geoData?.results?.[0];
            if (result) {
              const weatherRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current_weather=true`
              );
              const weather = await weatherRes.json();
              temp = weather?.current_weather?.temperature ?? null;
            }
          } catch {}
        }

        if (temp !== null) {
          sessionStorage.setItem('geo_temp', String(temp));
          setData({ city, temp });
        }
      } catch {}
    }
  }, []);

  return data;
}
