import fs from 'node:fs';
import { spawn } from 'node:child_process';

const hasDist = fs.existsSync('dist/index.html');
if (!hasDist) {
  console.error('[lighthouse] dist ausente. Rode npm run build antes.');
  process.exit(1);
}

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} saiu com código ${code}`)));
});

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'ignore', shell: process.platform === 'win32' });

try {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await run('npx', [
    'lighthouse',
    'http://127.0.0.1:4173/',
    '--quiet',
    '--preset=perf',
    '--form-factor=mobile',
    '--screenEmulation.mobile=true',
    '--screenEmulation.width=390',
    '--screenEmulation.height=844',
    '--screenEmulation.deviceScaleFactor=2.2',
    '--throttling.cpuSlowdownMultiplier=4',
    '--chrome-flags=--headless --no-sandbox',
    '--only-categories=performance,best-practices,seo,accessibility',
    '--budgets-path=./scripts/lighthouse-budget.json',
    '--output=json',
    '--output-path=./dist/lighthouse-report.json',
  ]);
  console.log('[lighthouse] OK — relatório em dist/lighthouse-report.json');
} finally {
  server.kill('SIGTERM');
}