export interface CityResult {
  name: string;
  state: string;
  ibgeCode: string;
}

// IBGE API: all 5,570 Brazilian municipalities (cached)
let ibgeCachePromise: Promise<CityResult[]> | null = null;

export function fetchAllMunicipalities(): Promise<CityResult[]> {
  if (ibgeCachePromise) return ibgeCachePromise;
  ibgeCachePromise = fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'
  )
    .then((res) => {
      if (!res.ok) throw new Error('IBGE API error');
      return res.json();
    })
    .then((data: any[]) =>
      data
        .map((m) => ({
          name: (m.nome || '') as string,
          state: (m.microrregiao?.mesorregiao?.UF?.sigla || '') as string,
          ibgeCode: String(m.id || ''),
        }))
        .filter((c) => c.name && c.state)
    )
    .catch(() => {
      ibgeCachePromise = null;
      return [] as CityResult[];
    });
  return ibgeCachePromise;
}

const geocodeCache = new Map<string, { latitude: number | null; longitude: number | null }>();

export async function geocodeCity(name: string, state: string) {
  const key = `${name}|${state}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  const query = encodeURIComponent(`${name}, ${state}, Brasil`);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${query}`
    );
    if (!res.ok) throw new Error('geocode failed');
    const data = await res.json();
    const result = {
      latitude: data?.[0]?.lat ? Number(data[0].lat) : null,
      longitude: data?.[0]?.lon ? Number(data[0].lon) : null,
    };
    geocodeCache.set(key, result);
    return result;
  } catch {
    const result = { latitude: null, longitude: null };
    geocodeCache.set(key, result);
    return result;
  }
}

export function normalize(s: string | undefined | null) {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function reverseGeocode(lat: number, lon: number) {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`
    );
    const data = await response.json();
    return {
      city: (data?.city || data?.locality || '') as string,
      state: (data?.principalSubdivision || '') as string,
    };
  } catch {
    return { city: '', state: '' };
  }
}
