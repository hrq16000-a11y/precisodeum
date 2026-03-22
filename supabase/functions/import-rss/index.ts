import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function autoSlug(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Strip all HTML tags, decode entities, normalize whitespace */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Try to extract og:image and og:description from a webpage */
async function fetchOgData(url: string): Promise<{ image: string | null; description: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PrecisodeumBot/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return { image: null, description: null };

    // Only read the first 50KB to find meta tags
    const reader = resp.body?.getReader();
    if (!reader) return { image: null, description: null };

    let html = '';
    const decoder = new TextDecoder();
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      // Stop once we've passed </head>
      if (html.includes('</head>')) break;
    }
    reader.cancel();

    // Extract og:image
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const image = ogImageMatch?.[1] || null;

    // Extract og:description or meta description
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ||
                         html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = ogDescMatch?.[1] || null;

    return { image, description };
  } catch {
    return { image: null, description: null };
  }
}

/** Try to resolve Google News redirect to get the real article URL */
async function resolveGoogleNewsUrl(gnUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(gnUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PrecisodeumBot/1.0)' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // The final URL after redirects is the real article
    return resp.url || gnUrl;
  } catch {
    return gnUrl;
  }
}

function parseRSSItems(xml: string): Array<{ title: string; link: string; description: string; pubDate?: string; imageUrl?: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate?: string; imageUrl?: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return (m?.[1] || m?.[2] || '').trim();
    };
    const title = get('title');
    const link = get('link');
    const description = get('description');
    const pubDate = get('pubDate');

    // Try to extract image from RSS fields
    const mediaMatch = block.match(/<media:content[^>]+url="([^"]+)"/i) ||
                        block.match(/<media:thumbnail[^>]+url="([^"]+)"/i) ||
                        block.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/i);
    const imageUrl = mediaMatch?.[1] || null;

    if (title && link) {
      items.push({ title, link, description, pubDate, imageUrl: imageUrl || undefined });
    }
  }
  return items;
}

function parseAtomItems(xml: string): Array<{ title: string; link: string; description: string; pubDate?: string; imageUrl?: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate?: string; imageUrl?: string }> = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return (m?.[1] || m?.[2] || '').trim();
    };
    const title = get('title');
    const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>|<link[^>]*>([^<]*)<\/link>/i);
    const link = linkMatch?.[1] || linkMatch?.[2] || '';
    const description = get('summary') || get('content');
    const pubDate = get('published') || get('updated');
    const mediaMatch = block.match(/<media:content[^>]+url="([^"]+)"/i) ||
                        block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
    const imageUrl = mediaMatch?.[1] || null;
    if (title && link) {
      items.push({ title, link, description, pubDate, imageUrl: imageUrl || undefined });
    }
  }
  return items;
}

/** Reject private/internal IPs and non-HTTPS URLs */
function isUrlSafe(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) return false;
    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // --- Auth: require admin ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await callerClient.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { feed_url, max_items = 10 } = await req.json();
    
    if (!feed_url) {
      return new Response(JSON.stringify({ error: 'feed_url is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isUrlSafe(feed_url)) {
      return new Response(JSON.stringify({ error: 'URL not allowed. Only HTTPS public URLs are permitted.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch(feed_url, {
      headers: { 'User-Agent': 'PrecisodeumBot/1.0' },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch feed: ${resp.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const xml = await resp.text();
    
    let items = parseRSSItems(xml);
    if (items.length === 0) {
      items = parseAtomItems(xml);
    }

    const limited = items.slice(0, Math.min(max_items, 50));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of limited) {
      const slug = autoSlug(item.title).slice(0, 100);
      
      // Check for duplicates
      const checkResp = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&select=id`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      const existing = await checkResp.json();
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Resolve real article URL (important for Google News links)
      let realUrl = item.link;
      if (item.link.includes('news.google.com')) {
        realUrl = await resolveGoogleNewsUrl(item.link);
      }

      // Fetch og:image and og:description from the real article page
      let coverImage = item.imageUrl || null;
      let articleDescription: string | null = null;

      if (realUrl && isUrlSafe(realUrl)) {
        const ogData = await fetchOgData(realUrl);
        if (!coverImage && ogData.image) {
          coverImage = ogData.image;
        }
        if (ogData.description) {
          articleDescription = ogData.description;
        }
      }

      // Clean HTML from RSS description
      const cleanRssDesc = stripHtml(item.description);
      
      // Use og:description if RSS description is too short or empty
      const bestDescription = (articleDescription && articleDescription.length > cleanRssDesc.length) 
        ? articleDescription 
        : cleanRssDesc;

      const excerpt = bestDescription.slice(0, 300);
      const content = bestDescription || `Leia a matéria completa na fonte original.`;

      const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          title: item.title,
          slug,
          excerpt,
          content,
          source_url: realUrl !== item.link ? realUrl : item.link,
          cover_image_url: coverImage,
          published: true,
          featured: false,
          author_name: 'Fonte Externa',
        }),
      });

      if (insertResp.ok) {
        imported++;
      } else {
        const errText = await insertResp.text();
        errors.push(`${slug}: ${errText}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      total_found: items.length,
      imported, 
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
