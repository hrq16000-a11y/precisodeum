// Deno test for `og-profile` edge function (E2E contra endpoint deployado).
//
// Cobertura:
//   1. Humano (UA Chrome) → 302 redirect para /profissional/:slug
//   2. Crawlers de paisagem (Facebook, Twitter) → 200 + og:image 1200x630 +
//      twitter:card="summary_large_image"
//   3. Crawlers de quadrado (WhatsApp, LinkedIn, Telegram) → 200 + og:image
//      1080x1080 + twitter:card="summary"
//   4. Slug inválido + crawler → 400 invalid_slug
//   5. ETag revalidation → 304 Not Modified
//   6. Headers de cache (max-age, s-maxage, stale-while-revalidate)
//   7. Vary: User-Agent presente (crítico — sem isso CDN pode servir HTML
//      do Facebook para WhatsApp e estourar o crop).
//
// Run:
//   supabase functions test og-profile
//
// Requer .env na raiz com VITE_SUPABASE_URL.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ??
  "https://qaftogrqeyymewoofexc.supabase.co";
const FN_URL = `${SUPABASE_URL}/functions/v1/og-profile`;

// Slug propositalmente improvável de existir — força fallback determinístico
// (título/descrição/imagem padrão), mas todas as meta tags ainda devem estar
// presentes para qualquer crawler. Trocar para um slug real torna o teste
// dependente de dados de produção.
const FALLBACK_SLUG = "ci-test-nonexistent-profile-slug";

const WIDE_CRAWLER_UAS: Record<string, string> = {
  facebook:
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  twitter: "Twitterbot/1.0",
};

const SQUARE_CRAWLER_UAS: Record<string, string> = {
  whatsapp: "WhatsApp/2.23.20.0 A",
  linkedin: "LinkedInBot/1.0 (compatible; Mozilla/5.0; +http://www.linkedin.com)",
  telegram: "TelegramBot (like TwitterBot)",
  discord: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
};

const HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchOg(
  ua: string,
  slug: string = FALLBACK_SLUG,
  headers: Record<string, string> = {},
) {
  return await fetch(`${FN_URL}?slug=${slug}`, {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": ua, ...headers },
  });
}

Deno.test("og-profile: human user is redirected (302) to SPA", async () => {
  const res = await fetchOg(HUMAN_UA);
  await res.body?.cancel();
  assertEquals(res.status, 302);
  const location = res.headers.get("location") ?? "";
  assertMatch(location, /\/profissional\/[a-z0-9-]+$/);
});

for (const [name, ua] of Object.entries(WIDE_CRAWLER_UAS)) {
  Deno.test(`og-profile: ${name} (wide) gets 1200x630 + summary_large_image`, async () => {
    const res = await fetchOg(ua);
    assertEquals(res.status, 200);

    const ct = res.headers.get("content-type") ?? "";
    assertStringIncludes(ct, "text/html");

    const cache = res.headers.get("cache-control") ?? "";
    assertStringIncludes(cache, "max-age=");
    assertStringIncludes(cache, "s-maxage=");
    assertStringIncludes(cache, "stale-while-revalidate");

    const vary = res.headers.get("vary") ?? "";
    assertStringIncludes(vary, "User-Agent");

    const html = await res.text();
    // OG tags obrigatórias
    assertStringIncludes(html, '<meta property="og:title"');
    assertStringIncludes(html, '<meta property="og:description"');
    assertStringIncludes(html, '<meta property="og:image"');
    assertStringIncludes(html, '<meta property="og:url"');
    assertStringIncludes(html, '<link rel="canonical"');
    // Dimensões wide (1200x630)
    assertStringIncludes(html, '<meta property="og:image:width" content="1200"');
    assertStringIncludes(html, '<meta property="og:image:height" content="630"');
    // Twitter card grande
    assertStringIncludes(
      html,
      '<meta name="twitter:card" content="summary_large_image"',
    );
  });
}

for (const [name, ua] of Object.entries(SQUARE_CRAWLER_UAS)) {
  Deno.test(`og-profile: ${name} (square) gets 1080x1080 + summary`, async () => {
    const res = await fetchOg(ua);
    assertEquals(res.status, 200);

    const html = await res.text();
    // Dimensões square (1080x1080)
    assertStringIncludes(html, '<meta property="og:image:width" content="1080"');
    assertStringIncludes(html, '<meta property="og:image:height" content="1080"');
    // Twitter card pequeno (1:1)
    assertStringIncludes(html, '<meta name="twitter:card" content="summary"');
    // Mas NÃO o "summary_large_image" — match exato
    assert(
      !html.includes('twitter:card" content="summary_large_image"'),
      "square crawler should NOT receive summary_large_image",
    );
  });
}

Deno.test("og-profile: ETag revalidation returns 304 Not Modified", async () => {
  const first = await fetchOg(WIDE_CRAWLER_UAS.facebook);
  await first.text();
  const etag = first.headers.get("etag");
  assert(etag, "first response must include ETag");

  const second = await fetchOg(
    WIDE_CRAWLER_UAS.facebook,
    FALLBACK_SLUG,
    { "If-None-Match": etag },
  );
  await second.body?.cancel();
  assertEquals(second.status, 304);
  assertEquals(second.headers.get("etag"), etag);
});

Deno.test("og-profile: invalid slug + crawler → 400 invalid_slug", async () => {
  // Slug com caracteres inválidos depois da sanitização vira string vazia
  const res = await fetch(`${FN_URL}?slug=___`, {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": WIDE_CRAWLER_UAS.facebook },
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "invalid_slug");
});

Deno.test("og-profile: empty slug + human → 302 to home (friendly)", async () => {
  const res = await fetch(`${FN_URL}?slug=`, {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": HUMAN_UA },
  });
  await res.body?.cancel();
  assertEquals(res.status, 302);
});

Deno.test("og-profile: ETag differs between wide and square crawlers", async () => {
  // Mesma rota, UAs diferentes → HTML diferente (dimensões e twitter:card)
  // → ETags diferentes. Garantia para o CDN respeitar Vary: User-Agent.
  const wide = await fetchOg(WIDE_CRAWLER_UAS.facebook);
  await wide.text();
  const sq = await fetchOg(SQUARE_CRAWLER_UAS.whatsapp);
  await sq.text();
  const wideTag = wide.headers.get("etag");
  const sqTag = sq.headers.get("etag");
  assert(wideTag && sqTag, "both responses must include ETag");
  assert(
    wideTag !== sqTag,
    "wide and square crawlers must produce distinct ETags",
  );
});
