// Edge Function: og-profile
// Serve OpenGraph/Twitter meta tags for /profissional/:slug to social crawlers
// (WhatsApp, Facebook, Telegram, Twitter, LinkedIn, Slack, Discord, etc.)
// while redirecting real users to the SPA.
//
// Why this is needed:
//   The app is an SPA — crawlers don't run JS, so they would never see the
//   profile-specific og:image / og:title / og:description set via useSeoHead.
//   This function returns server-rendered HTML <head> tags so a profile link
//   pasted into WhatsApp shows the professional's photo, name and category.
//
// Contract:
//   GET /functions/v1/og-profile?slug=<slug>
//   - If User-Agent matches a known social crawler:
//       returns 200 text/html with proper meta tags (no body content needed)
//   - Otherwise:
//       returns 302 redirect to https://precisodeum.com.br/profissional/<slug>
//
// Public endpoint (verify_jwt = false). Safe: only reads public_profiles view.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  buildOgImage,
  OG_IMAGE_SPECS,
  pickOgRatio,
  type OgImageRatio,
} from "./buildOgImage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Slug válido: 2–80 chars, lowercase, dígitos e hífen. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

// Crawlers that need server-rendered OG tags. Match is case-insensitive
// and uses simple substring tests (each value is normalized to lowercase).
const CRAWLER_SIGNATURES = [
  "facebookexternalhit",
  "facebot",
  "whatsapp",
  "twitterbot",
  "telegrambot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "pinterest",
  "skypeuripreview",
  "redditbot",
  "embedly",
  "vkshare",
  "applebot",
  "bingbot",
  "googlebot",
  "yandexbot",
  "duckduckbot",
  "baiduspider",
  "preview",
  "iframely",
];

const PUBLIC_SITE = "https://precisodeum.com.br";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isCrawler(ua: string | null): boolean {
  if (!ua) return false;
  const lc = ua.toLowerCase();
  return CRAWLER_SIGNATURES.some((sig) => lc.includes(sig));
}

function buildHtml(opts: {
  title: string;
  description: string;
  image: string;
  canonical: string;
}): string {
  const { title, description, image, canonical } = opts;
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(canonical);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<meta name="description" content="${safeDesc}" />
<link rel="canonical" href="${safeUrl}" />

<!-- Open Graph -->
<meta property="og:type" content="profile" />
<meta property="og:site_name" content="Preciso de um" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:url" content="${safeUrl}" />
<meta property="og:image" content="${safeImage}" />
<meta property="og:image:secure_url" content="${safeImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${safeTitle}" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDesc}" />
<meta name="twitter:image" content="${safeImage}" />

<!-- WhatsApp prefers og:image — already set above. -->
<meta http-equiv="refresh" content="0;url=${safeUrl}" />
</head>
<body>
<noscript><a href="${safeUrl}">${safeTitle}</a></noscript>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Slug can come from ?slug= or from the trailing path segment
  // (e.g. /functions/v1/og-profile/<slug>).
  let slug = url.searchParams.get("slug")?.trim() || "";
  if (!slug) {
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last !== "og-profile") slug = last;
  }
  slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);

  const canonical = slug
    ? `${PUBLIC_SITE}/profissional/${slug}`
    : PUBLIC_SITE;

  const ua = req.headers.get("user-agent");
  const crawler = isCrawler(ua);

  // Real users: redirect immediately to the SPA. Crawlers will fall through.
  if (!crawler) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: canonical },
    });
  }

  // Defaults if anything fails — crawlers should still get *something*.
  const fallbackTitle =
    "Preciso de um — Encontre um profissional para qualquer tipo de serviço";
  const fallbackDesc =
    "Conecte-se a profissionais qualificados em todo o Brasil. Negociação direta, sem leilão de preços.";
  const fallbackImage = `${PUBLIC_SITE}/og-image.jpg`;

  let title = fallbackTitle;
  let description = fallbackDesc;
  let image = fallbackImage;

  if (slug) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false } },
      );

      // public_profiles view enforces RLS and exposes only safe public fields.
      // We read defensively — any column may be missing depending on schema age.
      const { data: prof } = await supabase
        .from("public_profiles")
        .select(
          "full_name, avatar_url, headline, primary_category_label, city, state",
        )
        .eq("slug", slug)
        .maybeSingle<{
          full_name: string | null;
          avatar_url: string | null;
          headline: string | null;
          primary_category_label: string | null;
          city: string | null;
          state: string | null;
        }>();

      if (prof) {
        const name = prof.full_name?.trim() || "Profissional";
        const category = prof.primary_category_label?.trim() || "Serviços";
        const cityState = [prof.city, prof.state].filter(Boolean).join(" • ");

        title = `${name} — ${category} | Preciso de um`;
        description = prof.headline?.trim()
          ? prof.headline.trim()
          : cityState
          ? `${name} — ${category} em ${cityState}. Veja o perfil completo, portfólio e entre em contato direto.`
          : `${name} — ${category}. Veja o perfil completo, portfólio e entre em contato direto.`;
        if (prof.avatar_url) image = prof.avatar_url;
      }
    } catch (err) {
      // Never let a DB hiccup break the crawler response.
      console.error("[og-profile] lookup failed", err);
    }
  }

  const html = buildHtml({ title, description, image, canonical });

  // ETag estável baseado no conteúdo: permite If-None-Match → 304 Not Modified
  // (resposta de ~80 bytes em vez de ~2KB de HTML por hit do crawler).
  const etag = `W/"${await sha1Short(html)}"`;
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ...corsHeaders,
        ETag: etag,
        "Cache-Control":
          "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
        "X-Robots-Tag": "all",
      },
    });
  }

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      // Edge cache 10min, browser/crawler 5min, stale-while-revalidate 24h.
      // Crawlers do WhatsApp/Facebook re-scrapeiam ~7 dias; SWR cobre o gap
      // sem que ninguém veja preview frio mesmo após mudança de avatar.
      "Cache-Control":
        "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
      ETag: etag,
      Vary: "User-Agent, Accept-Encoding",
      "X-Robots-Tag": "all",
    },
  });
});

/** SHA-1 truncado (20 hex chars) — suficiente para ETag fraco por slug. */
async function sha1Short(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .slice(0, 10)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
