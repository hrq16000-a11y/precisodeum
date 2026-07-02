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

  const [
    { data: categories },
    { data: cities },
    { data: providers },
    { data: services },
  ] = await Promise.all([
    supabase.from('categories').select('id, slug, created_at'),
    supabase.from('cities').select('slug, created_at'),
    supabase.from('providers').select('slug, updated_at, category_id, city').eq('status', 'approved').not('slug', 'is', null),
    supabase.from('services').select('id, created_at, provider_id'),
  ]);

  let urls = '';

  // 1. Homepage - priority 1.0
  urls += url(siteUrl, '/', today, 'daily', '1.0');

  // 2. Static pages
  urls += url(siteUrl, '/buscar', today, 'daily', '0.8');
  urls += url(siteUrl, '/categorias', today, 'weekly', '0.7');
  urls += url(siteUrl, '/cidades', today, 'weekly', '0.7');
  urls += url(siteUrl, '/vagas', today, 'daily', '0.7');
  urls += url(siteUrl, '/blog', today, 'daily', '0.6');
  urls += url(siteUrl, '/faq', today, 'monthly', '0.4');
  urls += url(siteUrl, '/sobre', today, 'monthly', '0.3');

  // 3. Categories - priority 0.9
  for (const cat of categories || []) {
    urls += url(siteUrl, `/categoria/${cat.slug}`, lastmod(cat.created_at), 'daily', '0.9');
  }

  // 4. Providers - priority 0.7
  for (const p of providers || []) {
    urls += url(siteUrl, `/profissional/${p.slug}`, lastmod(p.updated_at), 'weekly', '0.7');
  }

  // 5. Cities - priority 0.8
  for (const city of cities || []) {
    urls += url(siteUrl, `/cidade/${city.slug}`, lastmod(city.created_at), 'weekly', '0.8');
  }

  const categoryById = new Map((categories || []).map((cat) => [cat.id, cat.slug]));
  const citySlugSet = new Set((cities || []).map((city) => city.slug));
  const seoLandingPaths = new Set<string>();

  for (const provider of providers || []) {
    const categorySlug = provider.category_id ? categoryById.get(provider.category_id) : null;
    const citySlug = slugify(provider.city || '');

    if (!categorySlug || !citySlug || !citySlugSet.has(citySlug)) continue;
    seoLandingPaths.add(`/${categorySlug}-${citySlug}`);
  }

  // 6. SEO programmatic pages with real provider coverage only
  for (const path of seoLandingPaths) {
    urls += url(siteUrl, path, today, 'weekly', '0.6');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
});

function lastmod(date: string): string {
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function url(base: string, path: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${escapeXml(base)}${escapeXml(path)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>\n`;
}
