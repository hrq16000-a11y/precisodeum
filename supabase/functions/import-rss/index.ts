import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function autoSlug(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Strip all HTML tags, decode entities, and normalize whitespace */
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

/** Try to extract an image URL from HTML description */
function extractImage(html: string): string | null {
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  if (match?.[1]) {
    const url = match[1];
    if (url.startsWith('http') && !url.includes('feedburner') && !url.includes('pixel')) {
      return url;
    }
  }
  // Try media:content or enclosure
  const mediaMatch = html.match(/<media:content[^>]+url="([^"]+)"/i) ||
                     html.match(/<enclosure[^>]+url="([^"]+)"/i);
  return mediaMatch?.[1] || null;
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

    // Try to extract image from various RSS fields
    let imageUrl = extractImage(block);
    if (!imageUrl) {
      const mediaMatch = block.match(/<media:content[^>]+url="([^"]+)"/i) ||
                          block.match(/<media:thumbnail[^>]+url="([^"]+)"/i) ||
                          block.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/i);
      imageUrl = mediaMatch?.[1] || null;
    }

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
    const imageUrl = extractImage(block);
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

    // --- SSRF protection ---
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

    for (const item of limited) {
      const slug = autoSlug(item.title).slice(0, 100);
      
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

      // Clean HTML from content and excerpt
      const cleanContent = stripHtml(item.description);
      const cleanExcerpt = cleanContent.slice(0, 300);

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
          excerpt: cleanExcerpt,
          content: cleanContent,
          source_url: item.link,
          cover_image_url: item.imageUrl || null,
          published: true,
          featured: false,
          author_name: 'Fonte Externa',
        }),
      });

      if (insertResp.ok) {
        imported++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      total_found: items.length,
      imported, 
      skipped,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
