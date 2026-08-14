import { describe, expect, it } from 'vitest';
import {
  correlateImagesWithLcp,
  imageLcpDaily,
  pearsonImageLcp,
  topImageIssues,
} from '@/lib/webVitals/imageCorrelation';
import { auditImageElement, summarizeImageAudits } from '@/lib/webVitals/imageHealth';
import type { VitalSample } from '@/lib/webVitals/summary';

const view = (route: string, at: string, lcp: number, errors = 0, degraded = 0): VitalSample[] => [
  { metric: 'LCP', value: lcp, route, created_at: at, viewport: '390x844' },
  { metric: 'IMG_ERROR', value: errors, route, created_at: at, viewport: '390x844' },
  { metric: 'IMG_DEGRADED', value: degraded, route, created_at: at, viewport: '390x844' },
];

const html = (markup: string): HTMLImageElement => {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host.querySelector('img') as HTMLImageElement;
};

describe('imageHealth · auditoria de contrato', () => {
  it('aprova hero com AVIF + WebP + srcSet + sizes', () => {
    const img = html(`
      <picture>
        <source type="image/avif" srcset="a-640.avif 640w" sizes="100vw" />
        <source type="image/webp" srcset="a-640.webp 640w" sizes="100vw" />
        <img src="a.jpg" srcset="a-640.jpg 640w" sizes="100vw" />
      </picture>`);
    expect(auditImageElement(img).issues).toEqual([]);
    expect(auditImageElement(img).scope).toBe('hero');
  });

  it('acusa ausência de AVIF/WebP e de sizes', () => {
    const img = html(`
      <picture>
        <source type="image/webp" srcset="a.webp 640w" />
        <img src="a.jpg" srcset="a.jpg 640w" />
      </picture>`);
    const issues = auditImageElement(img).issues;
    expect(issues).toContain('no_avif');
    expect(issues).toContain('no_sizes');
    expect(issues).not.toContain('no_webp');
  });

  it('acusa gallery sem srcSet e sem blur-up', () => {
    const img = html('<div><img data-loaded="false" src="g.jpg" /></div>');
    const audit = auditImageElement(img);
    expect(audit.scope).toBe('gallery');
    expect(audit.issues).toContain('no_srcset');
    expect(audit.issues).toContain('no_blurup');
  });

  it('aceita blur-up do LazyImage', () => {
    const img = html(`
      <div>
        <img data-testid="lazy-image-blur" src="tiny.jpg" />
        <img data-loaded="true" src="g.jpg" srcset="g.jpg 320w" sizes="50vw" />
      </div>`);
    const target = document.querySelectorAll('img[data-loaded]')[document.querySelectorAll('img[data-loaded]').length - 1] as HTMLImageElement;
    expect(auditImageElement(target).issues).not.toContain('no_blurup');
    expect(img).toBeTruthy();
  });

  it('consolida contadores separando erro de degradação', () => {
    const c = summarizeImageAudits(
      [
        { scope: 'hero', issues: ['no_avif', 'no_sizes'] },
        { scope: 'gallery', issues: [] },
        { scope: 'gallery', issues: ['error'] },
      ],
      1,
    );
    expect(c.audited).toBe(3);
    expect(c.errors).toBe(2);
    expect(c.degraded).toBe(1);
    expect(c.byIssue.no_avif).toBe(1);
  });
});

describe('imageCorrelation · rota', () => {
  it('marca provável causa quando visitas com problema têm LCP muito pior', () => {
    const samples = [
      ...view('/', '2026-08-10T10:00:00.000Z', 1800),
      ...view('/', '2026-08-10T10:01:00.000Z', 1900),
      ...view('/', '2026-08-10T10:02:00.000Z', 4800, 2, 3),
      ...view('/', '2026-08-10T10:03:00.000Z', 5200, 1, 3),
    ];
    const [row] = correlateImagesWithLcp(samples, 3);
    expect(row.route).toBe('/');
    expect(row.verdict).toBe('provavel_causa');
    expect(row.lcpDeltaMs).toBeGreaterThan(300);
    expect(row.affectedRate).toBe(50);
  });

  it('retorna ok quando não há problemas de imagem', () => {
    const samples = [
      ...view('/buscar', '2026-08-10T10:00:00.000Z', 1500),
      ...view('/buscar', '2026-08-10T10:01:00.000Z', 1600),
      ...view('/buscar', '2026-08-10T10:02:00.000Z', 1700),
    ];
    expect(correlateImagesWithLcp(samples, 3)[0].verdict).toBe('ok');
  });

  it('descarta rotas abaixo do mínimo de amostras', () => {
    expect(correlateImagesWithLcp(view('/x', '2026-08-10T10:00:00.000Z', 3000, 1), 3)).toHaveLength(0);
  });

  it('normaliza a rota removendo query string', () => {
    const samples = [
      ...view('/categoria/eletricista?p=2', '2026-08-10T10:00:00.000Z', 2000),
      ...view('/categoria/eletricista', '2026-08-10T10:01:00.000Z', 2100),
      ...view('/categoria/eletricista/', '2026-08-10T10:02:00.000Z', 2200),
    ];
    expect(correlateImagesWithLcp(samples, 3)[0].route).toBe('/categoria/eletricista');
  });
});

describe('imageCorrelation · série diária', () => {
  const daily = imageLcpDaily([
    ...view('/', '2026-08-10T10:00:00.000Z', 1800, 0, 0),
    ...view('/', '2026-08-11T10:00:00.000Z', 3000, 1, 2),
    ...view('/', '2026-08-12T10:00:00.000Z', 4500, 3, 4),
  ]);

  it('ordena por dia e soma os problemas', () => {
    expect(daily.map((d) => d.day)).toEqual(['2026-08-10', '2026-08-11', '2026-08-12']);
    expect(daily[2].errors).toBe(3);
    expect(daily[2].degraded).toBe(4);
  });

  it('calcula correlação positiva entre problemas e LCP', () => {
    expect(pearsonImageLcp(daily)).toBeGreaterThan(0.9);
  });

  it('retorna null com menos de 3 dias', () => {
    expect(pearsonImageLcp(daily.slice(0, 2))).toBeNull();
  });

  it('rankeia as rotas mais impactadas', () => {
    const rows = correlateImagesWithLcp([
      ...view('/', '2026-08-10T10:00:00.000Z', 1800),
      ...view('/', '2026-08-10T10:01:00.000Z', 1900),
      ...view('/', '2026-08-10T10:02:00.000Z', 5200, 2, 3),
    ], 3);
    expect(topImageIssues(rows)[0].route).toBe('/');
  });
});
