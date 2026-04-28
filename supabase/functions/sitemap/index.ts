import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const siteUrl = 'https://precisodeum.com.br';
  const today = new Date().toISOString().split('T')[0];

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const sitemapBaseUrl = `${siteUrl}/sitemap`;

  // Sitemap Index — returns links to sub-sitemaps
  if (!type) {
    const sitemaps = [
      'static', 'categories', 'especialidades', 'providers', 'cities',
      'blog', 'jobs', 'pages', 'popular', 'seo',
    ];
    const entries = sitemaps.map(s =>
      `  <sitemap>\n    <loc>${escapeXml(sitemapBaseUrl)}?type=${s}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;

    return respond(xml);
  }

  // Sub-sitemaps by type
  let urls = '';

  if (type === 'static') {
    urls += entry(siteUrl, '/', today, 'daily', '1.0');
    urls += entry(siteUrl, '/buscar', today, 'daily', '0.8');
    urls += entry(siteUrl, '/categorias', today, 'weekly', '0.8');
    urls += entry(siteUrl, '/especialidades', today, 'weekly', '0.8');
    urls += entry(siteUrl, '/cidades', today, 'weekly', '0.8');
    urls += entry(siteUrl, '/servicos', today, 'weekly', '0.7');
    urls += entry(siteUrl, '/vagas', today, 'daily', '0.7');
    urls += entry(siteUrl, '/blog', today, 'daily', '0.7');
    urls += entry(siteUrl, '/cursos', today, 'weekly', '0.6');
    urls += entry(siteUrl, '/faq', today, 'monthly', '0.5');
    urls += entry(siteUrl, '/sobre', today, 'monthly', '0.3');
    urls += entry(siteUrl, '/como-funciona', today, 'monthly', '0.4');
    urls += entry(siteUrl, '/privacidade', today, 'yearly', '0.2');
    urls += entry(siteUrl, '/termos', today, 'yearly', '0.2');
    urls += entry(siteUrl, '/cookies', today, 'yearly', '0.2');
  }

  if (type === 'categories') {
    const { data } = await supabase.from('categories').select('slug, created_at').is('deleted_at', null).range(0, 49999);
    for (const cat of data || []) {
      urls += entry(siteUrl, `/categoria/${cat.slug}`, fmtDate(cat.created_at), 'daily', '0.9');
    }
  }

  if (type === 'especialidades') {
    const { data } = await supabase.from('categories').select('slug, created_at').is('deleted_at', null).range(0, 49999);
    for (const cat of data || []) {
      urls += entry(siteUrl, `/especialidades/${cat.slug}`, fmtDate(cat.created_at), 'weekly', '0.85');
    }
  }

  // ─── Quality gates ───
  // Apenas prestadores/cidades/categorias com serviços "elegíveis SEO" entram no sitemap.
  // Critérios (heurística alinhada ao linter front-end / Padrão Ouro):
  //   1. Descrição com >= MIN_DESCRIPTION_LEN caracteres
  //   2. Descrição NÃO contém termos proibidos (forbidden_service_terms)
  //   3. service_area NÃO vazio (cidade validada pelo trigger enforce_service_city_coherence)
  //   4. Provider aprovado (status='approved')
  // Esses critérios reduzem indexação de listagens fracas e seguem
  // o memo "service_quality_min_score" (default 60).
  const MIN_DESCRIPTION_LEN = 80;

  // Carrega termos proibidos uma vez (poucos registros)
  const { data: forbiddenRows } = await supabase
    .from('forbidden_service_terms')
    .select('term');
  const forbiddenTerms: string[] = (forbiddenRows || [])
    .map((r: any) => String(r.term || '').toLowerCase().trim())
    .filter(Boolean);

  const isCleanDescription = (desc: string | null | undefined): boolean => {
    if (!desc || desc.length < MIN_DESCRIPTION_LEN) return false;
    const norm = desc.toLowerCase();
    return !forbiddenTerms.some(t => t && norm.includes(t));
  };

  // Pré-busca a base de serviços elegíveis (usada por providers/cities/categories/seo).
  // Limite alto mas finito para não estourar memória da edge.
  const { data: eligibleServices } = await supabase
    .from('services')
    .select('id, provider_id, description, service_area, category_id, providers!inner(id, slug, city, status, updated_at)')
    .is('deleted_at', null)
    .not('service_area', 'is', null)
    .neq('service_area', '')
    .eq('providers.status', 'approved')
    .range(0, 19999);

  type EligibleSvc = {
    id: string; provider_id: string; description: string | null;
    service_area: string | null; category_id: string | null;
    providers: { id: string; slug: string | null; city: string | null; status: string; updated_at: string };
  };
  const eligible: EligibleSvc[] = (eligibleServices || []).filter((s: any) =>
    isCleanDescription(s.description) &&
    s.providers?.slug &&
    // Coerência city ↔ service_area (case-insensitive)
    s.providers?.city && s.service_area &&
    String(s.service_area).trim().toLowerCase() === String(s.providers.city).trim().toLowerCase()
  ) as EligibleSvc[];

  const eligibleProviderSlugs = new Set<string>();
  const eligibleProvidersByDate = new Map<string, string>();
  const eligibleCityNames = new Set<string>();
  const eligibleCategoryIds = new Set<string>();
  for (const s of eligible) {
    if (s.providers.slug) {
      eligibleProviderSlugs.add(s.providers.slug);
      eligibleProvidersByDate.set(s.providers.slug, s.providers.updated_at);
    }
    if (s.providers.city) eligibleCityNames.add(s.providers.city.trim().toLowerCase());
    if (s.category_id) eligibleCategoryIds.add(s.category_id);
  }

  if (type === 'providers') {
    const { data } = await supabase
      .from('providers')
      .select('slug, updated_at')
      .eq('status', 'approved')
      .not('slug', 'is', null)
      .range(0, 49999);
    for (const p of data || []) {
      if (!eligibleProviderSlugs.has(p.slug)) continue; // gate de qualidade
      urls += entry(siteUrl, `/profissional/${p.slug}`, fmtDate(p.updated_at), 'weekly', '0.7');
    }
  }

  if (type === 'cities') {
    const { data } = await supabase.from('cities').select('slug, name, created_at').range(0, 49999);
    for (const city of data || []) {
      const norm = String(city.name || city.slug || '').trim().toLowerCase();
      if (!eligibleCityNames.has(norm)) continue; // gate
      urls += entry(siteUrl, `/cidade/${city.slug}`, fmtDate(city.created_at), 'weekly', '0.8');
    }
  }

  if (type === 'blog') {
    const { data } = await supabase.from('blog_posts').select('slug, updated_at').eq('published', true).is('deleted_at', null);
    for (const post of data || []) {
      urls += entry(siteUrl, `/blog/${post.slug}`, fmtDate(post.updated_at), 'weekly', '0.6');
    }
  }

  if (type === 'jobs') {
    const { data } = await supabase.from('jobs').select('slug, updated_at').eq('status', 'active').eq('approval_status', 'approved').is('deleted_at', null);
    for (const job of data || []) {
      if (job.slug) urls += entry(siteUrl, `/vagas/${job.slug}`, fmtDate(job.updated_at), 'daily', '0.6');
    }
  }

  if (type === 'pages') {
    const { data } = await supabase.from('institutional_pages').select('slug, updated_at').eq('published', true);
    for (const page of data || []) {
      urls += entry(siteUrl, `/p/${page.slug}`, fmtDate(page.updated_at), 'monthly', '0.4');
    }
  }

  if (type === 'popular') {
    const { data } = await supabase.from('popular_services').select('slug, updated_at').eq('active', true);
    for (const svc of data || []) {
      urls += entry(siteUrl, `/servico-popular/${svc.slug}`, fmtDate(svc.updated_at), 'weekly', '0.6');
    }
  }

  if (type === 'seo') {
    // Apenas combinações categoria × cidade com pelo menos 1 serviço elegível.
    const [{ data: cats }, { data: cities }] = await Promise.all([
      supabase.from('categories').select('id, slug').is('deleted_at', null),
      supabase.from('cities').select('slug, name'),
    ]);
    // Indexa elegibilidade por (category_id, city normalizada)
    const eligiblePairs = new Set<string>();
    for (const s of eligible) {
      const cityNorm = (s.providers.city || '').trim().toLowerCase();
      if (s.category_id && cityNorm) eligiblePairs.add(`${s.category_id}::${cityNorm}`);
    }
    for (const cat of cats || []) {
      for (const city of cities || []) {
        const cityNorm = String(city.name || city.slug || '').trim().toLowerCase();
        if (!eligiblePairs.has(`${cat.id}::${cityNorm}`)) continue;
        urls += entry(siteUrl, `/${cat.slug}-${city.slug}`, today, 'weekly', '0.6');
      }
    }
  }

  // Categorias só entram se tiverem ao menos 1 serviço elegível.
  // (mantemos categories como sub-sitemap separado mais acima)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

  return respond(xml);
});

function respond(xml: string) {
  return new Response(xml, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

function fmtDate(date: string): string {
  try { return new Date(date).toISOString().split('T')[0]; }
  catch { return new Date().toISOString().split('T')[0]; }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
}

function entry(base: string, path: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${escapeXml(base)}${escapeXml(path)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>\n`;
}
