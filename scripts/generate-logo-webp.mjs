import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const siteAssetsPath = path.join(projectRoot, 'src/lib/siteAssets.ts');
const publicDir = path.join(projectRoot, 'public');

const content = await fs.readFile(siteAssetsPath, 'utf8');
const logoUrl = content.match(/DEFAULT_LOGO_URL\s*=\s*['"]([^'"]+)['"]/)?.[1];
const srcset = content.match(/DEFAULT_LOGO_SRCSET\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? '';
const variants = [...srcset.matchAll(/([^\s,]+\.webp)\s+(\d+)w/g)].map(([, url, width]) => ({
  url,
  width: Number(width),
}));

if (!logoUrl || variants.length === 0) {
  throw new Error('Não foi possível localizar DEFAULT_LOGO_URL/DEFAULT_LOGO_SRCSET em src/lib/siteAssets.ts');
}

const sourcePath = path.join(publicDir, logoUrl.replace(/^\//, ''));
await fs.access(sourcePath);

const input = sharp(sourcePath, { animated: false });
const metadata = await input.metadata();

await Promise.all(
  variants.map(async ({ url, width }) => {
    const outputPath = path.join(publicDir, url.replace(/^\//, ''));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await sharp(sourcePath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 92, nearLossless: true, effort: 6 })
      .toFile(outputPath);

    const height = metadata.width && metadata.height
      ? Math.round((width / metadata.width) * metadata.height)
      : 'auto';

    console.log(`Logo WebP gerada: ${path.relative(projectRoot, outputPath)} (${width}x${height})`);
  })
);