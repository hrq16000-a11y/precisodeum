/**
 * Inventário das landings programáticas elegíveis.
 *
 * Fonte única para /admin/cidades (aba Páginas programáticas),
 * /admin/seo (edição de metadados) e /admin/otimizacao-local.
 * Gate anti thin content idêntico ao sitemap: cidade >= 1 profissional,
 * bairro >= 2.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  SERVICE_VERTICALS,
  verticalCityPath,
  verticalNeighborhoodPath,
} from '@/lib/programmaticServices';
import { slugifyNeighborhood } from '@/lib/handymanServiceContent';
import { sanitizeSlug } from '@/lib/slugify';

export const MIN_CITY_PROVIDERS = 1;
export const MIN_NEIGHBORHOOD_PROVIDERS = 2;

export interface ProgrammaticPageRow {
  vertical: string;
  verticalLabel: string;
  cityLabel: string;
  citySlug: string;
  neighborhoodLabel: string | null;
  neighborhoodSlug: string | null;
  state: string | null;
  providers: number;
  path: string;
  kind: 'cidade' | 'bairro';
}

export const PROGRAMMATIC_INVENTORY_KEY = ['admin-programmatic-pages'] as const;

export async function fetchProgrammaticInventory(): Promise<ProgrammaticPageRow[]> {
  const { data: cats } = await supabase.from('categories').select('id, slug');
  const catBySlug = new Map<string, string>();
  (cats || []).forEach((c: any) => catBySlug.set(c.slug, c.id));

  const out: ProgrammaticPageRow[] = [];
  for (const v of SERVICE_VERTICALS) {
    const ids = v.categorySlugs.map((s) => catBySlug.get(s)).filter(Boolean) as string[];
    if (!ids.length) continue;
    const { data } = await supabase
      .from('providers')
      .select('city, state, neighborhood')
      .in('category_id', ids)
      .eq('status', 'approved')
      .limit(2000);

    const cityMap = new Map<string, { label: string; state: string | null; count: number }>();
    const hoodMap = new Map<string, { cityLabel: string; citySlug: string; label: string; state: string | null; count: number }>();

    (data || []).forEach((p: any) => {
      const cityLabel = (p.city || '').trim();
      if (!cityLabel) return;
      const citySlug = sanitizeSlug(cityLabel);
      if (!citySlug) return;
      const cur = cityMap.get(citySlug) || { label: cityLabel, state: p.state || null, count: 0 };
      cur.count += 1;
      cityMap.set(citySlug, cur);

      const hoodLabel = (p.neighborhood || '').trim();
      if (!hoodLabel || hoodLabel.toLowerCase() === cityLabel.toLowerCase()) return;
      const hoodSlug = slugifyNeighborhood(hoodLabel);
      if (!hoodSlug) return;
      const hk = `${citySlug}|${hoodSlug}`;
      const h = hoodMap.get(hk) || { cityLabel, citySlug, label: hoodLabel, state: p.state || null, count: 0 };
      h.count += 1;
      hoodMap.set(hk, h);
    });

    cityMap.forEach((c, citySlug) => {
      if (c.count < MIN_CITY_PROVIDERS) return;
      out.push({
        vertical: v.slug,
        verticalLabel: v.label,
        cityLabel: c.label,
        citySlug,
        neighborhoodLabel: null,
        neighborhoodSlug: null,
        state: c.state,
        providers: c.count,
        kind: 'cidade',
        path: verticalCityPath(v, citySlug),
      });
    });

    hoodMap.forEach((h, key) => {
      if (h.count < MIN_NEIGHBORHOOD_PROVIDERS) return;
      const hoodSlug = key.split('|')[1];
      out.push({
        vertical: v.slug,
        verticalLabel: v.label,
        cityLabel: h.cityLabel,
        citySlug: h.citySlug,
        neighborhoodLabel: h.label,
        neighborhoodSlug: hoodSlug,
        state: h.state,
        providers: h.count,
        kind: 'bairro',
        path: verticalNeighborhoodPath(v, h.citySlug, hoodSlug),
      });
    });
  }

  return out.sort((a, b) => b.providers - a.providers);
}

export function useProgrammaticInventory() {
  return useQuery({
    queryKey: PROGRAMMATIC_INVENTORY_KEY,
    staleTime: 1000 * 60 * 5,
    queryFn: fetchProgrammaticInventory,
  });
}
