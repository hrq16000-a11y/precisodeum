import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const projectRoot = process.cwd();
const siteAssetsPath = path.join(projectRoot, 'src/lib/siteAssets.ts');
const publicDir = path.join(projectRoot, 'public');
const uploadsDir = path.join(publicDir, 'lovable-uploads');
const widths = [380, 710];

const args = process.argv.slice(2);
const uploadIndex = args.indexOf('--upload');
const uploadPath = uploadIndex >= 0 ? args[uploadIndex + 1] : '';

const toPublicUrl = (filePath) => `/${path.relative(publicDir, filePath).replaceAll(path.sep, '/')}`;
const fromPublicUrl = (url) => path.join(publicDir, url.replace(/^\//, ''));

const readSiteAssets = async () => {
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

  return { content, logoUrl, srcset, variants };
};

const cleanupOldLogoVariants = async (keepUrls) => {
  const keep = new Set(keepUrls.map((url) => fromPublicUrl(url)));
  const entries = await fs.readdir(uploadsDir).catch(() => []);

  await Promise.all(entries.map(async (entry) => {
    if (!/^logo-brand-[\w-]+\.webp$/.test(entry)) return;

    const filePath = path.join(uploadsDir, entry);
    if (keep.has(filePath)) return;

    await fs.rm(filePath, { force: true });
    console.log(`Logo WebP antiga removida: ${path.relative(projectRoot, filePath)}`);
  }));
};

const prepareUploadedLogo = async (currentContent, currentLogoUrl) => {
  const absoluteUploadPath = path.resolve(projectRoot, uploadPath);
  await fs.access(absoluteUploadPath);
  await fs.mkdir(uploadsDir, { recursive: true });

  const inputBuffer = await fs.readFile(absoluteUploadPath);
  const hash = crypto.createHash('sha256').update(inputBuffer).digest('hex').slice(0, 12);
  const ext = path.extname(absoluteUploadPath).toLowerCase() || '.png';
  const sourcePath = path.join(uploadsDir, `logo-brand-source-${hash}${ext}`);
  await fs.writeFile(sourcePath, inputBuffer);

  const variantUrls = widths.map((width) => `/lovable-uploads/logo-brand-${hash}-${width}.webp`);
  const nextSrcset = variantUrls.map((url, index) => `${url} ${widths[index]}w`).join(', ');
  const nextLogoUrl = toPublicUrl(sourcePath);
  const nextContent = currentContent
    .replace(/DEFAULT_LOGO_URL\s*=\s*['"][^'"]+['"]/, `DEFAULT_LOGO_URL = '${nextLogoUrl}'`)
    .replace(/DEFAULT_LOGO_SRCSET\s*=\s*['"][^'"]+['"]/, `DEFAULT_LOGO_SRCSET = '${nextSrcset}'`);

  await fs.writeFile(siteAssetsPath, nextContent);

  if (/^\/lovable-uploads\/logo-brand-source-/.test(currentLogoUrl) && currentLogoUrl !== nextLogoUrl) {
    await fs.rm(fromPublicUrl(currentLogoUrl), { force: true });
    console.log(`Logo base antiga removida: ${currentLogoUrl}`);
  }

  return {
    logoUrl: nextLogoUrl,
    variants: widths.map((width, index) => ({ width, url: variantUrls[index] })),
  };
};

const generateVariants = async (logoUrl, variants) => {
  const sourcePath = fromPublicUrl(logoUrl);
  await fs.access(sourcePath);

  const input = sharp(sourcePath, { animated: false });
  const metadata = await input.metadata();

  await Promise.all(
    variants.map(async ({ url, width }) => {
      const outputPath = fromPublicUrl(url);
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
};

const currentAssets = await readSiteAssets();

if (uploadIndex >= 0 && !uploadPath) {
  throw new Error('Informe o arquivo da nova logo: npm run assets:logo:upload -- ./caminho/logo.png');
}

const assets = uploadPath
  ? await prepareUploadedLogo(currentAssets.content, currentAssets.logoUrl)
  : currentAssets;

await generateVariants(assets.logoUrl, assets.variants);

if (uploadPath) {
  await cleanupOldLogoVariants(assets.variants.map(({ url }) => url));
}