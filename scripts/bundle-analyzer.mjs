import fs from 'node:fs';
import path from 'node:path';

const assetsDir = path.join(process.cwd(), 'dist/assets');
const reportPath = path.join(process.cwd(), 'dist/bundle-report.json');

if (!fs.existsSync(assetsDir)) {
  console.error('[bundle-analyzer] dist/assets ausente. Rode npm run build antes.');
  process.exit(1);
}

const assets = fs.readdirSync(assetsDir)
  .map((name) => {
    const sizeKb = fs.statSync(path.join(assetsDir, name)).size / 1024;
    const route = name.includes('SearchPage') ? '/buscar'
      : name.includes('CategoryPage') ? '/categoria/:slug'
      : name.includes('ProviderProfile') ? '/profissional/:slug'
      : name.includes('Index') ? '/index'
      : name.startsWith('index-') ? 'app-shell'
      : 'shared';
    return { name, route, sizeKb: Math.round(sizeKb * 10) / 10 };
  })
  .sort((a, b) => b.sizeKb - a.sizeKb);

fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), assets }, null, 2));
console.log('[bundle-analyzer] Top 12 chunks:');
for (const asset of assets.slice(0, 12)) console.log(`- ${asset.name} · ${asset.sizeKb}KB · ${asset.route}`);