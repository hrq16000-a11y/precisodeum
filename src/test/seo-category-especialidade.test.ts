import { describe, it, expect } from 'vitest';
import {
  getCategorySeoMeta,
  getEspecialidadeSeoMeta,
  getCategoryBreadcrumbs,
  getEspecialidadeBreadcrumbs,
} from '@/lib/categorySeo';

const cat = { name: 'Eletricista', slug: 'eletricista' };

describe('SEO contract — /categoria/:slug', () => {
  it('quando a categoria EXISTE: H1, meta description, canonical e indexável', () => {
    const meta = getCategorySeoMeta({ slug: 'eletricista', category: cat, providersCount: 12 });
    expect(meta.h1).toBe('Eletricista');
    expect(meta.title).toContain('Eletricista');
    expect(meta.title).toContain('Profissionais Verificados');
    expect(meta.description).toContain('12');
    expect(meta.description.length).toBeLessThanOrEqual(200);
    expect(meta.canonical).toBe('https://precisodeum.com.br/categoria/eletricista');
    expect(meta.noindex).toBe(false);
  });

  it('inclui o nome da cidade quando informada', () => {
    const meta = getCategorySeoMeta({ slug: 'eletricista', category: cat, city: 'Curitiba', providersCount: 8 });
    expect(meta.title).toContain('Curitiba');
    expect(meta.description).toContain('Curitiba');
    expect(meta.h1).toBe('Eletricista');
  });

  it('FALLBACK: categoria ausente → noindex + canonical preservado', () => {
    const meta = getCategorySeoMeta({ slug: 'inexistente', category: null });
    expect(meta.noindex).toBe(true);
    expect(meta.h1).toBe('Categoria não encontrada');
    expect(meta.canonical).toBe('https://precisodeum.com.br/categoria/inexistente');
    expect(meta.description.length).toBeGreaterThan(20);
  });

  it('FALLBACK total (sem slug e sem categoria): canonical undefined, noindex true', () => {
    const meta = getCategorySeoMeta({ slug: null, category: null });
    expect(meta.noindex).toBe(true);
    expect(meta.canonical).toBeUndefined();
  });
});

describe('SEO contract — /especialidades/:slug', () => {
  it('renderiza H1, meta e canonical quando a categoria existe', () => {
    const meta = getEspecialidadeSeoMeta({ slug: 'eletricista', category: cat });
    expect(meta.h1).toBe('Eletricista');
    expect(meta.title).toContain('Dicas de Especialista');
    expect(meta.description).toContain('eletricista');
    expect(meta.canonical).toBe('https://precisodeum.com.br/especialidades/eletricista');
    expect(meta.noindex).toBe(false);
  });

  it('FALLBACK: categoria ausente → noindex true + canonical do slug', () => {
    const meta = getEspecialidadeSeoMeta({ slug: 'xpto', category: null });
    expect(meta.noindex).toBe(true);
    expect(meta.h1).toBe('Especialidade não encontrada');
    expect(meta.canonical).toBe('https://precisodeum.com.br/especialidades/xpto');
  });
});

describe('Breadcrumbs — /categoria/:slug', () => {
  it('inclui Início → Categorias → Nome da categoria', () => {
    const bc = getCategoryBreadcrumbs({ slug: 'eletricista', category: cat });
    expect(bc).toHaveLength(3);
    expect(bc[0].name).toBe('Início');
    expect(bc[1].name).toBe('Categorias');
    expect(bc[1].url).toBe('https://precisodeum.com.br/categorias');
    expect(bc[2].name).toBe('Eletricista');
    expect(bc[2].url).toBe('https://precisodeum.com.br/categoria/eletricista');
  });

  it('FALLBACK sem categoria: ainda retorna Início → Categorias (2 itens)', () => {
    const bc = getCategoryBreadcrumbs({ slug: 'inexistente', category: null });
    expect(bc).toHaveLength(2);
    expect(bc[0].name).toBe('Início');
    expect(bc[1].name).toBe('Categorias');
  });
});

describe('Breadcrumbs — /especialidades/:slug', () => {
  it('inclui Início → Especialidades → Nome da especialidade', () => {
    const bc = getEspecialidadeBreadcrumbs({ slug: 'eletricista', category: cat });
    expect(bc).toHaveLength(3);
    expect(bc[1].name).toBe('Especialidades');
    expect(bc[2].name).toBe('Eletricista');
    expect(bc[2].url).toBe('https://precisodeum.com.br/especialidades/eletricista');
  });

  it('FALLBACK com slug mas sem categoria: 3 itens (slug humanizado), página noindex', () => {
    const bc = getEspecialidadeBreadcrumbs({ slug: 'meu-slug-novo', category: null });
    expect(bc).toHaveLength(3);
    expect(bc[2].name).toBe('meu slug novo');
    expect(bc[2].url).toContain('/especialidades/meu-slug-novo');
  });

  it('FALLBACK total (sem slug e sem categoria): apenas 2 itens', () => {
    const bc = getEspecialidadeBreadcrumbs({ slug: null, category: null });
    expect(bc).toHaveLength(2);
  });
});
