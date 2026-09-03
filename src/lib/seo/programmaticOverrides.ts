/**
 * Overrides editoriais das landings programáticas.
 *
 * A geração continua automática (profissionais aprovados definem quais páginas
 * existem). Esta camada permite ao admin, sem deploy:
 *   - desativar uma página (vira noindex + sai do sitemap lógico);
 *   - sobrescrever title / meta description / keywords;
 *   - registrar uma nota editorial.
 *
 * Tabela: public.programmatic_page_overrides (leitura pública, escrita admin).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProgrammaticOverride {
  id: string;
  path: string;
  vertical: string;
  city_slug: string | null;
  neighborhood_slug: string | null;
  enabled: boolean;
  title: string | null;
  meta_description: string | null;
  keywords: string | null;
  editorial_note: string | null;
  updated_at: string;
}

export const PROGRAMMATIC_OVERRIDES_KEY = ['programmatic-page-overrides'] as const;

export async function fetchProgrammaticOverrides(): Promise<ProgrammaticOverride[]> {
  const { data, error } = await supabase
    .from('programmatic_page_overrides')
    .select('id, path, vertical, city_slug, neighborhood_slug, enabled, title, meta_description, keywords, editorial_note, updated_at')
    .order('updated_at', { ascending: false })
    .limit(2000);
  if (error) return [];
  return (data as unknown as ProgrammaticOverride[]) || [];
}

/** Todos os overrides (usado pelos painéis admin). */
export function useProgrammaticOverrides() {
  return useQuery({
    queryKey: PROGRAMMATIC_OVERRIDES_KEY,
    staleTime: 60_000,
    queryFn: fetchProgrammaticOverrides,
  });
}

/** Override de uma única rota — consumido pela página pública. */
export function useProgrammaticOverride(path: string | null | undefined) {
  return useQuery({
    queryKey: ['programmatic-page-override', path],
    enabled: !!path,
    staleTime: 60_000,
    queryFn: async (): Promise<ProgrammaticOverride | null> => {
      const { data, error } = await supabase
        .from('programmatic_page_overrides')
        .select('id, path, vertical, city_slug, neighborhood_slug, enabled, title, meta_description, keywords, editorial_note, updated_at')
        .eq('path', path as string)
        .maybeSingle();
      if (error) return null;
      return (data as unknown as ProgrammaticOverride) || null;
    },
  });
}

export interface SeoShape { title: string; description: string; keywords: string }

/** Aplica o override sobre o SEO gerado (campos vazios não sobrescrevem). */
export function applyOverrideToSeo<T extends SeoShape>(
  seo: T,
  override: ProgrammaticOverride | null | undefined,
): T {
  if (!override) return seo;
  return {
    ...seo,
    title: override.title?.trim() || seo.title,
    description: override.meta_description?.trim() || seo.description,
    keywords: override.keywords?.trim() || seo.keywords,
  };
}

/** Página desativada manualmente pelo admin. */
export function isOverrideDisabled(override: ProgrammaticOverride | null | undefined): boolean {
  return !!override && override.enabled === false;
}
