import { supabase } from '@/integrations/supabase/client';

export interface GeocodeInput {
  address?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
}

export interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  source: 'nominatim' | 'ibge' | 'none';
}

/**
 * Geocoding invisível via Edge Function (Nominatim → IBGE fallback).
 * Chamado automaticamente ao salvar endereço — sem botão manual.
 */
export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult> {
  try {
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: input,
    });
    if (error) {
      return { latitude: null, longitude: null, source: 'none' };
    }
    return {
      latitude: data?.latitude ?? null,
      longitude: data?.longitude ?? null,
      source: data?.source ?? 'none',
    };
  } catch {
    return { latitude: null, longitude: null, source: 'none' };
  }
}
