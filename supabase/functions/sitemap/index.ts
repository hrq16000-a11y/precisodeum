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
  const sitemapBaseUrl = `${url.origin}${url.pathname}`;

  // Sitemap Index — returns links to sub-sitemaps
  if (!type) {
    const sitemaps = [
      'static', 'categories', 'providers', 'cities',
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

  if (type === 'providers') {
    const { data } = await supabase.from('providers').select('slug, updated_at').eq('status', 'approved').not('slug', 'is', null).range(0, 49999);
    for (const p of data || []) {
      urls += entry(siteUrl, `/profissional/${p.slug}`, fmtDate(p.updated_at), 'weekly', '0.7');
    }
  }

  if (type === 'cities') {
    const { data } = await supabase.from('cities').select('slug, created_at').range(0, 49999);
    for (const city of data || []) {
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
    const [{ data: cats }, { data: cities }] = await Promise.all([
      supabase.from('categories').select('slug').is('deleted_at', null),
      supabase.from('cities').select('slug'),
    ]);
    for (const cat of cats || []) {
      for (const city of cities || []) {
        urls += entry(siteUrl, `/${cat.slug}-${city.slug}`, today, 'weekly', '0.6');
      }
    }
  }

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
