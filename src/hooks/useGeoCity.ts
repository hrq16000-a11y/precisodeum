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
    if (cachedCity) {
      setData({ city: cachedCity, temp: cachedTemp ? Number(cachedTemp) : null });
      return;
    }

    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(async (d) => {
        const city = d?.city || null;
        const lat = d?.latitude;
        const lon = d?.longitude;
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

        if (city) {
          sessionStorage.setItem('geo_city', city);
          if (temp !== null) sessionStorage.setItem('geo_temp', String(temp));
          setData({ city, temp });
        }
      })
      .catch(() => {});
  }, []);

  return data;
}
