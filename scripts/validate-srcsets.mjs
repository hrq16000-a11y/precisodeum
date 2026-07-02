import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const assetsFile = path.join(root, 'src/lib/siteAssets.ts');
const content = fs.readFileSync(assetsFile, 'utf8');

const fail = (message) => {
  console.error(`[srcset] ${message}`);
  process.exitCode = 1;
};

const parseConst = (name) => content.match(new RegExp(`${name}\\s*=\\s*['"]([^'"]+)['"]`))?.[1] || '';
const parseSrcset = (srcset) => srcset.split(',').map((part) => {
  const [url, width] = part.trim().split(/\s+/);
  return { url, width: Number(String(width || '').replace('w', '')) };
}).filter((entry) => entry.url && entry.width);

const webp = parseSrcset(parseConst('DEFAULT_LOGO_SRCSET'));
const png = parseSrcset(parseConst('DEFAULT_LOGO_PNG_SRCSET'));

if (webp.length === 0) fail('DEFAULT_LOGO_SRCSET não contém variantes WebP.');
if (png.length === 0) fail('DEFAULT_LOGO_PNG_SRCSET não contém variantes PNG.');
if (webp.length !== png.length) fail('WebP e PNG precisam ter a mesma quantidade de variantes.');

for (const entry of [...webp, ...png]) {
  const filePath = path.join(publicDir, entry.url.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) {
    fail(`Arquivo ausente no srcset: ${entry.url}`);
    continue;
  }
  const metadata = await sharp(filePath).metadata();
  if (metadata.width !== entry.width) {
    fail(`Largura incorreta em ${entry.url}: esperado ${entry.width}px, encontrado ${metadata.width}px.`);
  }
  if (!['webp', 'png'].includes(metadata.format || '')) {
    fail(`Formato inválido em ${entry.url}: ${metadata.format || 'desconhecido'}.`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`[srcset] OK — ${webp.length} WebP + ${png.length} PNG validados.`);