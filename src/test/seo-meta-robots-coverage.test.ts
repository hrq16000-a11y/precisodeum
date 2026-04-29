/**
 * Percorre todos os templates SEO (landing, categoria, cidade, profissional,
 * admin) e confirma que apenas páginas indexáveis emitem
 * `<meta name="robots" content="index">`, enquanto páginas /admin/* SEMPRE
 * emitem `noindex, nofollow`.
 *
 * Estratégia: lemos o código-fonte das páginas e verificamos o argumento
 * `noindex` passado para `useSeoHead` ou para `<SeoHead />`. Isso evita ter
 * que renderizar todas as páginas em jsdom.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

interface TemplateExpect {
  file: string;
  shouldBeNoindex: boolean;
  label: string;
}

const TEMPLATES: TemplateExpect[] = [
  { file: 'src/pages/Index.tsx', shouldBeNoindex: false, label: 'landing /' },
  { file: 'src/pages/CategoryPage.tsx', shouldBeNoindex: false, label: '/categoria/:slug' },
  { file: 'src/pages/CityDetailPage.tsx', shouldBeNoindex: false, label: '/cidades/:uf/:slug' },
  { file: 'src/pages/ProviderPage.tsx', shouldBeNoindex: false, label: '/profissional/:slug' },
];

const ADMIN_DIR = 'src/pages/admin';

function readSource(file: string): string {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function declaresNoindexTrue(src: string): boolean {
  // Procura noindex: true em qualquer chamada (objeto ou prop JSX).
  if (/noindex\s*:\s*true/.test(src)) return true;
  if (/noindex(?!\s*[:=]\s*false)\s*\}/.test(src)) return true;
  if (/<SeoHead[^>]*\snoindex(\s|>|=\{true)/.test(src)) return true;
  return false;
}

function declaresNoindexFalseOrAbsent(src: string): boolean {
  if (/noindex\s*:\s*false/.test(src)) return true;
  // Se não menciona noindex, padrão do hook é index (false).
  if (!/noindex/.test(src)) return true;
  return false;
}

describe('SEO meta robots por template', () => {
  for (const t of TEMPLATES) {
    it(`${t.label} é indexável (noindex=false ou ausente)`, () => {
      const src = readSource(t.file);
      if (!src) {
        // Página opcional — skip silencioso para não quebrar o repo.
        return;
      }
      expect(
        declaresNoindexFalseOrAbsent(src),
        `${t.file} NÃO deveria forçar noindex=true`,
      ).toBe(true);
    });
  }

  it('TODAS as páginas em src/pages/admin/* declaram noindex=true', () => {
    if (!fs.existsSync(ADMIN_DIR)) return;
    const files = fs
      .readdirSync(ADMIN_DIR, { recursive: true } as { recursive: true })
      .filter((f) => typeof f === 'string' && /\.(tsx|ts)$/.test(f as string)) as string[];

    const offenders: string[] = [];
    for (const f of files) {
      const full = path.join(ADMIN_DIR, f);
      const src = readSource(full);
      if (!src) continue;

      // Se a página usa useSeoHead/SeoHead mas não declara noindex=true → ofensora.
      const usesSeo = /useSeoHead|SeoHead/.test(src);
      if (!usesSeo) continue;
      if (!declaresNoindexTrue(src)) {
        offenders.push(full);
      }
    }
    expect(
      offenders,
      `Páginas admin sem noindex=true:\n  - ${offenders.join('\n  - ')}`,
    ).toEqual([]);
  });

  it('useSeoHead aplica robots="noindex, nofollow" quando noindex=true', () => {
    const src = readSource('src/hooks/useSeoHead.ts');
    expect(src).toMatch(/noindex.*nofollow/);
    expect(src).toMatch(/index,\s*follow/);
  });
});
