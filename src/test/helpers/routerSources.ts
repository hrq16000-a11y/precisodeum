/**
 * Helper compartilhado de scanners estáticos de rotas (PR 3.1).
 *
 * Após o split estrutural do `src/App.tsx` (PR 3), as definições de rota
 * vivem em múltiplos arquivos:
 *   - src/App.tsx                       (composição + rotas-raiz)
 *   - src/routes/publicRoutes.tsx
 *   - src/routes/dashboardRoutes.tsx
 *   - src/routes/adminRoutes.tsx
 *   - src/routes/sponsorRoutes.tsx
 *
 * Testes estáticos (regex / includes) que antes liam apenas App.tsx agora
 * devem agregar todos esses fontes para evitar falsos negativos.
 *
 * Esta é a ÚNICA fonte de verdade para "fontes do roteador" em tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

export const ROUTER_SOURCE_FILES = [
  'src/App.tsx',
  'src/routes/publicRoutes.tsx',
  'src/routes/dashboardRoutes.tsx',
  'src/routes/adminRoutes.tsx',
  'src/routes/sponsorRoutes.tsx',
] as const;

/**
 * Concatena o conteúdo de todos os arquivos de roteamento numa única string.
 * Cada arquivo é precedido por um marcador `// ===== <path> =====` para
 * facilitar depuração em caso de regex falho.
 */
export function readRouterSources(): string {
  return ROUTER_SOURCE_FILES.map((rel) => {
    const full = join(ROOT, rel);
    try {
      return `// ===== ${rel} =====\n${readFileSync(full, 'utf8')}`;
    } catch {
      return '';
    }
  }).join('\n\n');
}

/** Atalho compatível para testes que esperam o conteúdo do "App". */
export const APP_AND_ROUTES = readRouterSources();
