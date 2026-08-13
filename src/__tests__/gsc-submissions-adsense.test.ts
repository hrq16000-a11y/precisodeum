import { describe, it, expect } from 'vitest';
import {
  summarizeBySitemap,
  groupRuns,
  diffCoverage,
  sitemapGroup,
  environmentFromHost,
  resolveEnvProperty,
  GSC_PROPERTY_SETTING_KEYS,
  type GscAuditRow,
} from '@/lib/seo/gscSubmissions';
import { analyzeAdsenseHtml, summarizeAdsenseReports, ADSENSE_PUBLISHER_ID } from '@/lib/seo/adsenseCheck';

const row = (over: Partial<GscAuditRow>): GscAuditRow => ({
  id: 1,
  action: 'submit-sitemap',
  site: 'https://www.precisodeum.com.br/',
  sitemap: 'https://www.precisodeum.com.br/sitemap?type=providers',
  status: 200,
  ok: true,
  error: null,
  created_at: '2026-08-13T05:00:00.000Z',
  ...over,
});

describe('gscSubmissions — agregação do audit log', () => {
  it('resume por sitemap com falhas primeiro', () => {
    const out = summarizeBySitemap([
      row({ id: 1, created_at: '2026-08-13T05:00:00.000Z' }),
      row({ id: 2, sitemap: 'https://x/sitemap?type=cities', ok: false, status: 500, error: 'boom', created_at: '2026-08-13T05:01:00.000Z' }),
      row({ id: 3, created_at: '2026-08-13T05:02:00.000Z', ok: false, status: 429, error: 'rate' }),
    ]);
    expect(out[0].lastOk).toBe(false);
    const providers = out.find((s) => s.sitemap.includes('providers'))!;
    expect(providers.attempts).toBe(2);
    expect(providers.failures).toBe(1);
    expect(providers.successRate).toBeCloseTo(0.5);
  });

  it('agrupa rodadas por janela temporal', () => {
    const runs = groupRuns([
      row({ id: 1, created_at: '2026-08-13T05:00:00.000Z' }),
      row({ id: 2, created_at: '2026-08-13T05:02:00.000Z' }),
      row({ id: 3, created_at: '2026-08-13T09:00:00.000Z', ok: false }),
    ]);
    expect(runs).toHaveLength(2);
    expect(runs[0].failed).toBe(1); // mais recente primeiro
    expect(runs[1].total).toBe(2);
  });

  it('ignora ações que não são submit-sitemap', () => {
    expect(summarizeBySitemap([row({ action: 'verify' })])).toHaveLength(0);
  });
});

describe('gscSubmissions — alertas de cobertura', () => {
  const before = [{ sitemap: '/sitemap?type=cities', submitted: 100, indexed: 90, errors: 0, warnings: 0 }];

  it('classifica aumento grande de erros como crítico', () => {
    const alerts = diffCoverage(before, [
      { sitemap: '/sitemap?type=cities', submitted: 100, indexed: 90, errors: 12, warnings: 0 },
    ]);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].metric).toBe('errors');
    expect(alerts[0].suggestion).toMatch(/canônicos/i);
  });

  it('detecta queda de indexação', () => {
    const alerts = diffCoverage(before, [
      { sitemap: '/sitemap?type=cities', submitted: 100, indexed: 40, errors: 0, warnings: 0 },
    ]);
    expect(alerts.some((a) => a.metric === 'indexed' && a.severity === 'critical')).toBe(true);
  });

  it('não gera alertas quando a cobertura melhora', () => {
    const alerts = diffCoverage(before, [
      { sitemap: '/sitemap?type=cities', submitted: 120, indexed: 110, errors: 0, warnings: 0 },
    ]);
    expect(alerts).toHaveLength(0);
  });

  it('extrai grupo legível da URL do sub-sitemap', () => {
    expect(sitemapGroup('https://x/sitemap?type=cities&page=2')).toBe('cities (página 2)');
    expect(sitemapGroup('https://x/sitemap.xml')).toBe('sitemap.xml');
  });
});

describe('gscSubmissions — múltiplas propriedades por ambiente', () => {
  const verified = ['sc-domain:precisodeum.com.br', 'https://www.precisodeum.com.br/'];

  it('detecta ambiente pelo host', () => {
    expect(environmentFromHost('www.precisodeum.com.br')).toBe('prod');
    expect(environmentFromHost('id-preview--x.lovable.app')).toBe('staging');
    expect(environmentFromHost('localhost')).toBe('dev');
  });

  it('prioriza override, depois setting, depois única verificada', () => {
    expect(resolveEnvProperty('prod', {}, verified, verified[1])).toBe(verified[1]);
    expect(
      resolveEnvProperty('prod', { [GSC_PROPERTY_SETTING_KEYS.prod]: verified[0] }, verified),
    ).toBe(verified[0]);
    expect(resolveEnvProperty('dev', {}, [verified[0]])).toBe(verified[0]);
    expect(resolveEnvProperty('dev', {}, verified)).toBeNull();
  });
});

describe('adsenseCheck', () => {
  const goodHtml = `<html><head><meta name="google-adsense-account" content="${ADSENSE_PUBLISHER_ID}">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}" crossorigin="anonymous"></script></head><body></body></html>`;

  it('aprova rota bem configurada', () => {
    const r = analyzeAdsenseHtml('/', goodHtml, 200);
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
    expect(r.metaClient).toBe(ADSENSE_PUBLISHER_ID);
  });

  it('reporta meta e script ausentes', () => {
    const r = analyzeAdsenseHtml('/buscar', '<html><head></head></html>', 200);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['meta_missing', 'script_missing']),
    );
  });

  it('avisa sobre script sem async/crossorigin e ins incompleto', () => {
    const html = `<meta name="google-adsense-account" content="${ADSENSE_PUBLISHER_ID}">
      <script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}"></script>
      <ins class="adsbygoogle"></ins>`;
    const r = analyzeAdsenseHtml('/blog', html, 200);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('script_not_async');
    expect(codes).toContain('script_missing_crossorigin');
    expect(codes).toContain('ins_without_client');
    expect(r.insBlocks).toBe(1);
  });

  it('sumariza rotas com erro', () => {
    const s = summarizeAdsenseReports([
      analyzeAdsenseHtml('/', goodHtml, 200),
      analyzeAdsenseHtml('/x', '<html></html>', 200),
    ]);
    expect(s.total).toBe(2);
    expect(s.errorCount).toBe(1);
    expect(s.routesWithErrors).toEqual(['/x']);
  });
});
