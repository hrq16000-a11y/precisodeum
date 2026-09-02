import { createServerFn } from "@tanstack/react-start";

import { handymanNeighborhoodSlug, handymanSlugCandidates, humanizeSlug } from "./handymanServiceContent";

export interface ResolvedServiceLocal {
  cityLabel: string;
  citySlug: string;
  state: string | null;
  neighborhoodSlug: string;
  neighborhoodLabel: string;
  providerCount: number;
}

/**
 * Resolve cidade/bairro de um slug local ("curitiba", "curitiba-batel") para
 * que o `head()` das landings programáticas seja renderizado no servidor com
 * título, descrição e canonical corretos (crawler não executa JS).
 *
 * Leitura pública: usa a chave publicável, respeitando RLS de anônimo.
 */
export const resolveServiceLocal = createServerFn({ method: "GET" })
  .inputValidator((data: { localSlug: string }) => ({
    localSlug: String(data?.localSlug || "").slice(0, 120),
  }))
  .handler(async ({ data }): Promise<ResolvedServiceLocal | null> => {
    const slug = data.localSlug;
    if (!slug) return null;

    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: any, init: any) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    try {
      const candidates = handymanSlugCandidates(slug);
      const { data: rows } = await supabase
        .from("cities")
        .select("name, state, slug")
        .in("slug", candidates);
      const match = ((rows as any[] | null) || []).sort((a, b) => b.slug.length - a.slug.length)[0];
      if (!match) return null;

      const neighborhoodSlug = handymanNeighborhoodSlug(slug, match.slug);
      return {
        cityLabel: match.name || humanizeSlug(match.slug),
        citySlug: match.slug,
        state: match.state || null,
        neighborhoodSlug,
        neighborhoodLabel: neighborhoodSlug ? humanizeSlug(neighborhoodSlug) : "",
        providerCount: 0,
      };
    } catch {
      return null;
    }
  });
