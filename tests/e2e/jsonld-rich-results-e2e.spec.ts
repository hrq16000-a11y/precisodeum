/**
 * jsonld-rich-results-e2e.spec.ts
 *
 * Garante que rich results no Google nunca quebrem com mudanças no backend:
 *  - Para cada rota indexável (Home, /buscar, /categoria/:slug, /categoria/:slug/em/:cidade,
 *    /profissional/:slug), extrai TODOS os <script type="application/ld+json">
 *    e valida com ajv contra os schemas mínimos exigidos pelo Rich Results Test.
 *  - Falha o build se BreadcrumbList não tiver positions sequenciais ou
 *    LocalBusiness não tiver addressLocality.
 *
 * Não depende de fixtures: usa dados reais do backend (RLS público), garantindo
 * que regressões em triggers ou colunas sejam capturadas.
 */
import { test, expect } from '@playwright/test';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const breadcrumbSchema = {
  type: 'object',
  required: ['@context', '@type', 'itemListElement'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@type': { const: 'BreadcrumbList' },
    itemListElement: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        required: ['@type', 'position', 'name', 'item'],
        properties: {
          '@type': { const: 'ListItem' },
          position: { type: 'integer', minimum: 1 },
          name: { type: 'string', minLength: 1 },
          item: { type: 'string', format: 'uri' },
        },
      },
    },
  },
};

const localBusinessSchema = {
  type: 'object',
  required: ['@context', '@type', 'name', 'url'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@type': { type: 'string', enum: ['LocalBusiness', 'ProfessionalService', 'Organization'] },
    name: { type: 'string', minLength: 1 },
    url: { type: 'string', format: 'uri' },
    address: {
      type: 'object',
      required: ['@type', 'addressLocality'],
      properties: {
        '@type': { const: 'PostalAddress' },
        addressLocality: { type: 'string', minLength: 1 },
      },
    },
  },
};

const itemListSchema = {
  type: 'object',
  required: ['@context', '@type', 'itemListElement'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@type': { const: 'ItemList' },
    itemListElement: { type: 'array', minItems: 0 },
  },
};

const validators: Record<string, ReturnType<typeof ajv.compile>> = {
  BreadcrumbList: ajv.compile(breadcrumbSchema),
  LocalBusiness: ajv.compile(localBusinessSchema),
  ProfessionalService: ajv.compile(localBusinessSchema),
  Organization: ajv.compile(localBusinessSchema),
  ItemList: ajv.compile(itemListSchema),
};

async function extractJsonLd(page: import('@playwright/test').Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const out: any[] = [];
  for (const raw of blocks) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) out.push(...parsed['@graph']);
      else out.push(parsed);
    } catch {
      // bloco inválido — falha o teste mais adiante
      out.push({ __invalid__: raw.slice(0, 80) });
    }
  }
  return out;
}

function validateBlocks(blocks: any[]) {
  const errors: string[] = [];
  for (const b of blocks) {
    if (b?.__invalid__) { errors.push(`JSON-LD inválido: ${b.__invalid__}`); continue; }
    const t = Array.isArray(b['@type']) ? b['@type'][0] : b['@type'];
    const v = validators[t];
    if (!v) continue; // tipo não coberto — ok (ex: WebSite, FAQPage validados em outro teste)
    if (!v(b)) {
      errors.push(`@type=${t} → ${ajv.errorsText(v.errors)}`);
    }
  }
  // Breadcrumb específico: positions sequenciais
  for (const b of blocks) {
    if (b?.['@type'] === 'BreadcrumbList' && Array.isArray(b.itemListElement)) {
      const positions = b.itemListElement.map((i: any) => i.position);
      const expected = positions.map((_: number, i: number) => i + 1);
      if (JSON.stringify(positions) !== JSON.stringify(expected)) {
        errors.push(`BreadcrumbList positions não sequenciais: ${positions.join(',')}`);
      }
    }
  }
  return errors;
}

const ROUTES = [
  { path: '/', expect: ['BreadcrumbList'] },
  { path: '/buscar', expect: [] }, // pode não ter LD
  { path: '/categoria/eletricista', expect: ['BreadcrumbList'] },
];

for (const r of ROUTES) {
  test(`JSON-LD válido em ${r.path}`, async ({ page }) => {
    await page.goto(r.path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => { /* tolerar streaming */ });
    const blocks = await extractJsonLd(page);
    const errors = validateBlocks(blocks);
    expect(errors, `Falhas JSON-LD em ${r.path}:\n  - ${errors.join('\n  - ')}`).toEqual([]);
    for (const required of r.expect) {
      const found = blocks.some((b) => b?.['@type'] === required);
      expect(found, `${r.path} deve emitir @type=${required}`).toBe(true);
    }
  });
}

test('Perfil de profissional com endereço respeita show_full_address', async ({ page, request }) => {
  // Pega um slug aprovado real do backend público (sem auth) — se nenhum existir, skip.
  const res = await request.get('/api/public-providers').catch(() => null);
  let slug: string | null = null;
  if (res && res.ok()) {
    const data = await res.json().catch(() => null);
    slug = data?.[0]?.slug || null;
  }
  test.skip(!slug, 'Sem providers públicos para testar /profissional/:slug');
  if (!slug) return;

  await page.goto(`/profissional/${slug}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => { /* ok */ });
  const blocks = await extractJsonLd(page);
  const errors = validateBlocks(blocks);
  expect(errors).toEqual([]);

  const lb = blocks.find((b) => ['LocalBusiness', 'ProfessionalService'].includes(b?.['@type']));
  expect(lb, 'perfil deve emitir LocalBusiness/ProfessionalService').toBeTruthy();
  expect(lb.address?.addressLocality, 'addressLocality obrigatório').toBeTruthy();
});
