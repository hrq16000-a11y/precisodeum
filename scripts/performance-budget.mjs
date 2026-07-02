import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distAssets = path.join(root, 'dist/assets');
const MAX_ENTRY_JS_KB = 260;
const MAX_CHUNK_JS_KB = 1300;
const MAX_TOTAL_JS_KB = 5600;
const MAX_IMAGE_KB = 900;
const routeHints = [
  ['SearchPage', '/buscar'],
  ['CategoryPage', '/categoria/:slug'],
  ['ProviderProfile', '/profissional/:slug'],
  ['Index', '/index'],
  ['AdminSystemHealthPage', '/admin/sistema/saude'],
];

const fail = (message) => {
  console.error(`[perf-budget] ${message}`);
  process.exitCode = 1;
};

if (!fs.existsSync(distAssets)) {
  fail('dist/assets não encontrado. Rode npm run build antes do budget.');
  process.exit(process.exitCode);
}

const files = fs.readdirSync(distAssets).map((name) => {
  const filePath = path.join(distAssets, name);
  return { name, sizeKb: fs.statSync(filePath).size / 1024 };
});

const jsFiles = files.filter((f) => f.name.endsWith('.js'));
const imageFiles = files.filter((f) => /\.(webp|png|jpe?g|avif)$/i.test(f.name));
const totalJsKb = jsFiles.reduce((sum, file) => sum + file.sizeKb, 0);

for (const file of jsFiles) {
  const limit = file.name.startsWith('index-') ? MAX_ENTRY_JS_KB : MAX_CHUNK_JS_KB;
  if (file.sizeKb > limit) {
    const route = routeHints.find(([hint]) => file.name.includes(hint))?.[1];
    fail(`${file.name} tem ${file.sizeKb.toFixed(1)}KB, acima do limite ${limit}KB${route ? ` · rota provável ${route}` : ''}.`);
  }
}

for (const file of imageFiles) {
  if (file.sizeKb > MAX_IMAGE_KB) fail(`${file.name} tem ${file.sizeKb.toFixed(1)}KB, acima do limite ${MAX_IMAGE_KB}KB.`);
}

if (totalJsKb > MAX_TOTAL_JS_KB) fail(`JS total tem ${totalJsKb.toFixed(1)}KB, acima do limite ${MAX_TOTAL_JS_KB}KB.`);

if (process.exitCode) process.exit(process.exitCode);
console.log(`[perf-budget] OK — JS total ${totalJsKb.toFixed(1)}KB em ${jsFiles.length} chunks.`);