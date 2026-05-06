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
    supabase.from('categories').select('slug, created_at'),
    supabase.from('cities').select('slug, created_at'),
    supabase.from('providers').select('slug, updated_at').eq('status', 'approved').not('slug', 'is', null),
    supabase.from('services').select('id, created_at, provider_id'),
  ]);

  let urls = '';

  // 1. Homepage - priority 1.0
  urls += url(siteUrl, '/', today, 'daily', '1.0');

  // 2. Static pages
  urls += url(siteUrl, '/buscar', today, 'daily', '0.8');
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

  // 6. SEO programmatic pages: category + city
  for (const cat of categories || []) {
    for (const city of cities || []) {
      urls += url(siteUrl, `/${cat.slug}-${city.slug}`, today, 'weekly', '0.6');
    }
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

function url(base: string, path: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${escapeXml(base)}${escapeXml(path)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>\n`;
}
