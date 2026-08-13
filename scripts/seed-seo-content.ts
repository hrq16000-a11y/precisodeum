/**
 * Seed de conteúdo SEO programático — N categorias × M cidades.
 *
 * Gera textos únicos + FAQ para landings locais, respeitando:
 *   - `isSeoContentEligible` / `buildContentBlocks` (guard de thin content)
 *   - `shouldIndex` (strategy de noindex fail-closed)
 *
 * Uso:
 *   bunx tsx scripts/seed-seo-content.ts --categories=eletricista,encanador \
 *     --cities=curitiba,sao-jose-dos-pinhais --providers=5 --out=.lovable/seo-seed.json
 *
 * O script NÃO escreve no banco: produz um JSON revisável (dry-run por padrão),
 * evitando publicar páginas rasas por engano.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildContentBlocks, isSeoContentEligible } from '../src/lib/seo/seoContentBlocks';
import { shouldIndex } from '../src/lib/seo/seoIndexationGuard';
import { buildLocalCategoryFaq } from '../src/components/seo/SeoFaqBlock';

interface Args {
  categories: string[];
  cities: string[];
  providers: number;
  out: string;
}

function parseArgs(): Args {
  const get = (name: string, fallback = '') => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : fallback;
  };
  const list = (v: string) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    categories: list(get('categories')),
    cities: list(get('cities')),
    providers: Number(get('providers', '0')) || 0,
    out: get('out', '.lovable/seo-seed.json'),
  };
}

const titleize = (slug: string) =>
  slug
    .split('-')
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

function main() {
  const args = parseArgs();
  if (!args.categories.length || !args.cities.length) {
    console.error('Informe --categories= e --cities= (slugs separados por vírgula).');
    process.exit(1);
  }

  const entries: unknown[] = [];
  let indexable = 0;
  let skipped = 0;

  for (const categorySlug of args.categories) {
    for (const citySlug of args.cities) {
      const categoryName = titleize(categorySlug);
      const cityName = titleize(citySlug);
      const path = `/categoria/${categorySlug}/em/${citySlug}`;

      const contentInput = {
        categoryName,
        citySlug,
        cityName,
        providersCount: args.providers,
      };

      const eligibility = isSeoContentEligible(contentInput);
      const blocks = buildContentBlocks(contentInput);
      const faq = buildLocalCategoryFaq({ categoryName, cityName, providersCount: args.providers });

      const verdict = shouldIndex({
        type: 'category_city',
        path,
        categorySlug,
        citySlug,
        providersCount: args.providers,
        hasUsefulContent: blocks.length > 0,
      });

      if (!verdict.index || !blocks.length) skipped += 1;
      else indexable += 1;

      entries.push({
        path,
        categorySlug,
        citySlug,
        categoryName,
        cityName,
        eligible: eligibility.eligible,
        eligibilityReasons: eligibility.reasons,
        robots: verdict.robots,
        canonicalPath: verdict.canonicalPath,
        indexReasons: verdict.reasons,
        wordCount: blocks.reduce(
          (n, b) =>
            n +
            b.title.split(/\s+/).filter(Boolean).length +
            b.paragraphs.reduce((s, p) => s + p.split(/\s+/).filter(Boolean).length, 0),
          0,
        ),
        blocks,
        faq,
      });
    }
  }

  const outPath = resolve(args.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), indexable, skipped, total: entries.length, entries },
      null,
      2,
    ),
  );
  console.log(
    `seo-seed: ${entries.length} páginas (${indexable} indexáveis, ${skipped} noindex/thin) → ${outPath}`,
  );
}

main();
