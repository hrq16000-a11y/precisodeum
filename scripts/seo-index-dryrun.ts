/**
 * DRY-RUN de indexação — matriz N categorias × M cidades.
 *
 * Gera um relatório CSV + JSON com o veredito (index / noindex) de cada
 * combinação, para revisão ANTES de publicar qualquer landing.
 * O script NÃO escreve no banco e NÃO publica nada.
 *
 * Uso:
 *   npm run seo:dryrun -- --categories=eletricista,encanador \
 *     --cities=curitiba,pinhais --providers=5 --out=.lovable/seo-dryrun
 *
 * Saídas: <out>.json e <out>.csv
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildContentBlocks, isSeoContentEligible } from '../src/lib/seo/seoContentBlocks';
import { shouldIndex } from '../src/lib/seo/seoIndexationGuard';
import { buildLocalCategoryFaq } from '../src/components/seo/SeoFaqBlock';

interface Row {
  path: string;
  categorySlug: string;
  citySlug: string;
  providers: number;
  eligible: boolean;
  index: boolean;
  robots: string;
  canonicalPath: string;
  wordCount: number;
  faqCount: number;
  reasons: string;
}

function arg(name: string, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const list = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);
const titleize = (slug: string) =>
  slug.split('-').map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

function csvCell(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function main() {
  const categories = list(arg('categories'));
  const cities = list(arg('cities'));
  const providers = Number(arg('providers', '0')) || 0;
  const out = arg('out', '.lovable/seo-dryrun');

  if (!categories.length || !cities.length) {
    console.error('Informe --categories= e --cities= (slugs separados por vírgula).');
    process.exit(1);
  }

  const rows: Row[] = [];

  for (const categorySlug of categories) {
    for (const citySlug of cities) {
      const categoryName = titleize(categorySlug);
      const cityName = titleize(citySlug);
      const path = `/categoria/${categorySlug}/em/${citySlug}`;
      const contentInput = { categoryName, citySlug, cityName, providersCount: providers };

      const eligibility = isSeoContentEligible(contentInput);
      const blocks = buildContentBlocks(contentInput);
      const faq = buildLocalCategoryFaq({
        categoryName,
        cityName,
        providersCount: providers,
        eligible: eligibility.eligible,
      });

      const verdict = shouldIndex({
        type: 'category_city',
        path,
        categorySlug,
        citySlug,
        providersCount: providers,
        hasUsefulContent: blocks.length > 0,
      });

      rows.push({
        path,
        categorySlug,
        citySlug,
        providers,
        eligible: eligibility.eligible,
        index: verdict.index && blocks.length > 0,
        robots: verdict.robots,
        canonicalPath: verdict.canonicalPath,
        wordCount: blocks.reduce(
          (n, b) =>
            n +
            b.title.split(/\s+/).filter(Boolean).length +
            b.paragraphs.reduce((s, p) => s + p.split(/\s+/).filter(Boolean).length, 0),
          0,
        ),
        faqCount: faq.length,
        reasons: [...eligibility.reasons, ...verdict.reasons].join('|'),
      });
    }
  }

  const indexable = rows.filter((r) => r.index).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    categories: categories.length,
    cities: cities.length,
    total: rows.length,
    indexable,
    noindex: rows.length - indexable,
    rows,
  };

  const jsonPath = resolve(`${out}.json`);
  const csvPath = resolve(`${out}.csv`);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const header = Object.keys(rows[0]) as Array<keyof Row>;
  const csv = [
    header.join(','),
    ...rows.map((r) => header.map((h) => csvCell(r[h])).join(',')),
  ].join('\n');
  writeFileSync(csvPath, `${csv}\n`);

  console.log(
    `seo-dryrun: ${rows.length} combinações (${indexable} index / ${rows.length - indexable} noindex)\n  → ${jsonPath}\n  → ${csvPath}`,
  );
}

main();
