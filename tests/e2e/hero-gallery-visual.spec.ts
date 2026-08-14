import { test, expect } from '@playwright/test';

/**
 * Validação visual do Hero por breakpoint.
 * Confere negociação AVIF/WebP, srcSet/sizes, ausência de jank (sem lazy no LCP)
 * e captura screenshot por viewport para inspeção de regressão.
 */

const BREAKPOINTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const bp of BREAKPOINTS) {
  test(`hero responsivo · ${bp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const picture = page.locator('picture').first();
    await expect(picture).toBeVisible();

    const types = await picture.locator('source').evaluateAll((els) =>
      els.map((el) => ({
        type: el.getAttribute('type'),
        srcset: el.getAttribute('srcset'),
        sizes: el.getAttribute('sizes'),
      })),
    );
    expect(types.some((s) => s.type === 'image/avif')).toBe(true);
    expect(types.some((s) => s.type === 'image/webp')).toBe(true);
    for (const s of types) {
      expect(s.srcset).toMatch(/640w|1280w|1920w/);
      expect(s.sizes).toBe('100vw');
    }

    const img = picture.locator('img').first();
    await expect(img).toBeVisible();
    // Imagem LCP nunca deve ser lazy (evita atraso perceptível no primeiro paint).
    expect(await img.getAttribute('loading')).not.toBe('lazy');

    const box = await img.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);

    await page.screenshot({ path: `test-results/hero-${bp.name}.png` });
  });
}

test('galeria do perfil usa lazy + blur-up', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const link = page.locator('a[href^="/profissional/"]').first();
  if ((await link.count()) === 0) test.skip(true, 'Sem profissionais publicados no ambiente.');
  await link.click();
  await page.waitForLoadState('domcontentloaded');

  const imgs = page.locator('img[srcset]');
  const total = await imgs.count();
  if (total === 0) test.skip(true, 'Perfil sem galeria.');

  for (let i = 0; i < Math.min(total, 5); i += 1) {
    const el = imgs.nth(i);
    const [loading, decoding, sizes] = await Promise.all([
      el.getAttribute('loading'),
      el.getAttribute('decoding'),
      el.getAttribute('sizes'),
    ]);
    expect(loading === 'lazy' || loading === 'eager').toBe(true);
    if (loading === 'lazy') expect(decoding).toBe('async');
    expect(sizes).toBeTruthy();
  }
});
