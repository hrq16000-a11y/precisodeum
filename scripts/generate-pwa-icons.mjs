import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, 'public');
const iconsDir = path.join(publicDir, 'icons');
const startupDir = path.join(iconsDir, 'startup');
const siteAssetsPath = path.join(projectRoot, 'src/lib/siteAssets.ts');
const manifestPath = path.join(publicDir, 'manifest.json');
const indexPath = path.join(projectRoot, 'index.html');
const headersPath = path.join(publicDir, '_headers');

const APP_NAME = 'Preciso de um Profissional';
const SHORT_NAME = 'Preciso de Um';
const START_URL = '/?source=pwa';
const THEME_COLOR = '#F97316';
const BACKGROUND_COLOR = '#ffffff';

const webIconSizes = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512];
const appleIconSizes = [57, 60, 72, 76, 114, 120, 144, 152, 167, 180];
const icoSizes = [16, 32, 48];
const startupPortraits = [
  [640, 1136, 2, '320px', '568px'],
  [750, 1334, 2, '375px', '667px'],
  [828, 1792, 2, '414px', '896px'],
  [1125, 2436, 3, '375px', '812px'],
  [1170, 2532, 3, '390px', '844px'],
  [1242, 2688, 3, '414px', '896px'],
  [1284, 2778, 3, '428px', '926px'],
  [1290, 2796, 3, '430px', '932px'],
  [1536, 2048, 2, '768px', '1024px'],
  [1668, 2224, 2, '834px', '1112px'],
  [1668, 2388, 2, '834px', '1194px'],
  [2048, 2732, 2, '1024px', '1366px'],
];

const toPublicUrl = (filePath) => `/${path.relative(publicDir, filePath).replaceAll(path.sep, '/')}`;
const fromPublicUrl = (url) => path.join(publicDir, url.replace(/^\//, '').split('?')[0]);
const fileHash = (buffer, length = 10) => crypto.createHash('sha256').update(buffer).digest('hex').slice(0, length);

const readLogoUrl = async () => {
  const content = await fs.readFile(siteAssetsPath, 'utf8');
  const logoUrl = content.match(/DEFAULT_LOGO_URL\s*=\s*['"]([^'"]+)['"]/)?.[1];
  if (!logoUrl) throw new Error('DEFAULT_LOGO_URL não encontrado em src/lib/siteAssets.ts');
  return logoUrl;
};

const renderSquareIcon = async (sourcePath, size) => {
  const logoBuffer = await sharp(sourcePath)
    .resize({ width: Math.round(size * 0.82), height: Math.round(size * 0.82), fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND_COLOR,
    },
  })
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
};

const writeIco = async (pngEntries, outputPath) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngEntries.length, 4);

  const directory = Buffer.alloc(16 * pngEntries.length);
  let offset = 6 + directory.length;

  pngEntries.forEach(({ size, buffer }, index) => {
    const base = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, base);
    directory.writeUInt8(size >= 256 ? 0 : size, base + 1);
    directory.writeUInt8(0, base + 2);
    directory.writeUInt8(0, base + 3);
    directory.writeUInt16LE(1, base + 4);
    directory.writeUInt16LE(32, base + 6);
    directory.writeUInt32LE(buffer.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += buffer.length;
  });

  await fs.writeFile(outputPath, Buffer.concat([header, directory, ...pngEntries.map(({ buffer }) => buffer)]));
};

const renderStartup = async (sourcePath, width, height) => {
  const logoBuffer = await sharp(sourcePath)
    .resize({ width: Math.round(width * 0.48), height: Math.round(height * 0.22), fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: BACKGROUND_COLOR,
    },
  })
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
};

const cleanupGeneratedIcons = async () => {
  await fs.mkdir(iconsDir, { recursive: true });
  await fs.mkdir(startupDir, { recursive: true });
  const entries = await fs.readdir(iconsDir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    if (entry.isDirectory()) return;
    if (/^(icon|apple-touch-icon|favicon)-.+\.(png|ico)$/.test(entry.name)) {
      await fs.rm(path.join(iconsDir, entry.name), { force: true });
    }
  }));
  const startupEntries = await fs.readdir(startupDir).catch(() => []);
  await Promise.all(startupEntries.map((entry) => fs.rm(path.join(startupDir, entry), { force: true })));
};

const updateManifest = async ({ icons, hash }) => {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const pwaIcons = icons
    .filter(({ size }) => [72, 96, 128, 144, 152, 192, 384, 512].includes(size))
    .map(({ size, src }) => ({ src, sizes: `${size}x${size}`, type: 'image/png', purpose: size >= 192 ? 'any maskable' : 'any' }));
  const shortcutIcon = icons.find(({ size }) => size === 192)?.src || icons.at(-1)?.src;

  const nextManifest = {
    ...manifest,
    name: APP_NAME,
    short_name: SHORT_NAME,
    start_url: START_URL,
    id: START_URL,
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: pwaIcons,
    shortcuts: (manifest.shortcuts || []).map((shortcut) => ({
      ...shortcut,
      icons: shortcutIcon ? [{ src: shortcutIcon, sizes: '192x192', type: 'image/png' }] : shortcut.icons,
    })),
    _generated_icon_version: hash,
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
};

const appleStartupTags = (startupImages) => startupImages.map(({ src, cssWidth, cssHeight, ratio, orientation }) => (
  `    <link rel="apple-touch-startup-image" href="${src}" media="(device-width: ${cssWidth}) and (device-height: ${cssHeight}) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})" />`
)).join('\n');

const updateIndexHead = async ({ icons, appleIcons, startupImages, faviconIco, hash }) => {
  const index = await fs.readFile(indexPath, 'utf8');
  const icon16 = icons.find(({ size }) => size === 16)?.src;
  const icon32 = icons.find(({ size }) => size === 32)?.src;
  const icon192 = icons.find(({ size }) => size === 192)?.src;
  const icon512 = icons.find(({ size }) => size === 512)?.src;

  const appleTags = appleIcons.map(({ size, src }) => (
    `    <link rel="apple-touch-icon" sizes="${size}x${size}" href="${src}" />`
  )).join('\n');

  const iconBlock = [
    `    <link rel="icon" href="${faviconIco}?v=${hash}" sizes="any" />`,
    icon16 ? `    <link rel="icon" type="image/png" sizes="16x16" href="${icon16}" />` : '',
    icon32 ? `    <link rel="icon" type="image/png" sizes="32x32" href="${icon32}" />` : '',
    icon192 ? `    <link rel="icon" type="image/png" sizes="192x192" href="${icon192}" />` : '',
    icon512 ? `    <link rel="icon" type="image/png" sizes="512x512" href="${icon512}" />` : '',
    `    <link rel="shortcut icon" href="/favicon.ico?v=${hash}" />`,
    `    <link rel="manifest" href="/manifest.json?v=${hash}" />`,
    `    <meta name="theme-color" content="${THEME_COLOR}" />`,
    `    <meta name="apple-mobile-web-app-capable" content="yes" />`,
    `    <meta name="apple-mobile-web-app-status-bar-style" content="default" />`,
    `    <meta name="apple-mobile-web-app-title" content="${SHORT_NAME}" />`,
    appleTags,
    appleStartupTags(startupImages),
  ].filter(Boolean).join('\n');

  const nextIndex = index.replace(
    /    <link rel="icon"[\s\S]*?    <link rel="apple-touch-icon" href="\/icons\/icon-192\.png" \/>/,
    iconBlock,
  );

  if (nextIndex === index) {
    throw new Error('Bloco de ícones do index.html não foi localizado para atualização');
  }

  await fs.writeFile(indexPath, nextIndex);
};

const updateHeaders = async () => {
  const current = await fs.readFile(headersPath, 'utf8');
  let next = current;
  if (!next.includes('/icons/*')) {
    next = next.replace(/\/lovable-uploads\/\*\n  Cache-Control: public, max-age=31536000, immutable/, '/lovable-uploads/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/icons/*\n  Cache-Control: public, max-age=31536000, immutable');
  }
  if (!next.includes('/favicon.ico')) {
    next = next.replace(/\/manifest\.json\n  Cache-Control: public, max-age=3600, stale-while-revalidate=86400/, '/favicon.ico\n  Cache-Control: public, max-age=3600, stale-while-revalidate=86400\n\n/manifest.json\n  Cache-Control: public, max-age=3600, stale-while-revalidate=86400');
  }
  await fs.writeFile(headersPath, next);
};

const validateReferences = async () => {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const index = await fs.readFile(indexPath, 'utf8');
  const referenced = new Set();

  for (const icon of manifest.icons || []) referenced.add(icon.src);
  for (const shortcut of manifest.shortcuts || []) {
    for (const icon of shortcut.icons || []) referenced.add(icon.src);
  }
  for (const match of index.matchAll(/<(?:link)[^>]+href="([^"]+)"/g)) {
    const href = match[1];
    if (/^https?:\/\//.test(href) || href.startsWith('//')) continue;
    if (/\.(png|ico|json)(\?|$)/.test(href)) referenced.add(href);
  }

  const missing = [];
  for (const href of referenced) {
    const clean = href.split('?')[0];
    if (clean === '/manifest.json') continue;
    try {
      await fs.access(fromPublicUrl(clean));
    } catch {
      missing.push(href);
    }
  }

  if (missing.length) {
    throw new Error(`Arquivos referenciados não encontrados:\n${missing.join('\n')}`);
  }
};

const logoUrl = await readLogoUrl();
const sourcePath = fromPublicUrl(logoUrl);
const sourceBuffer = await fs.readFile(sourcePath);
const hash = fileHash(sourceBuffer);

await cleanupGeneratedIcons();

const icons = [];
for (const size of webIconSizes) {
  const buffer = await renderSquareIcon(sourcePath, size);
  const outputPath = path.join(iconsDir, `icon-${size}x${size}-${hash}.png`);
  await fs.writeFile(outputPath, buffer);
  icons.push({ size, src: toPublicUrl(outputPath) });
}

const appleIcons = [];
for (const size of appleIconSizes) {
  const existing = icons.find((icon) => icon.size === size);
  if (existing) {
    appleIcons.push(existing);
    continue;
  }
  const buffer = await renderSquareIcon(sourcePath, size);
  const outputPath = path.join(iconsDir, `apple-touch-icon-${size}x${size}-${hash}.png`);
  await fs.writeFile(outputPath, buffer);
  appleIcons.push({ size, src: toPublicUrl(outputPath) });
}

const icoBuffers = await Promise.all(icoSizes.map(async (size) => ({ size, buffer: await renderSquareIcon(sourcePath, size) })));
const versionedIcoPath = path.join(iconsDir, `favicon-${hash}.ico`);
await writeIco(icoBuffers, versionedIcoPath);
await fs.copyFile(versionedIcoPath, path.join(publicDir, 'favicon.ico'));

const startupImages = [];
for (const [width, height, ratio, cssWidth, cssHeight] of startupPortraits) {
  for (const orientation of ['portrait', 'landscape']) {
    const outputWidth = orientation === 'portrait' ? width : height;
    const outputHeight = orientation === 'portrait' ? height : width;
    const buffer = await renderStartup(sourcePath, outputWidth, outputHeight);
    const outputPath = path.join(startupDir, `startup-${outputWidth}x${outputHeight}-${hash}.png`);
    await fs.writeFile(outputPath, buffer);
    startupImages.push({
      src: toPublicUrl(outputPath),
      cssWidth: orientation === 'portrait' ? cssWidth : cssHeight,
      cssHeight: orientation === 'portrait' ? cssHeight : cssWidth,
      ratio,
      orientation,
    });
  }
}

await updateManifest({ icons, hash });
await updateIndexHead({ icons, appleIcons, startupImages, faviconIco: toPublicUrl(versionedIcoPath), hash });
await updateHeaders();
await validateReferences();

console.log(`Ícones PWA gerados com versão ${hash}`);
console.log(`Arquivos PNG: ${icons.length + appleIcons.filter(({ size }) => !webIconSizes.includes(size)).length}`);
console.log(`Startup images iOS: ${startupImages.length}`);
console.log(`Favicon ICO: ${toPublicUrl(versionedIcoPath)} e /favicon.ico`);
