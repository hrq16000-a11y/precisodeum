#!/usr/bin/env node

/**
 * Mantém o build de publicação curto e determinístico.
 *
 * O comando anterior usava `node -e ... && node scripts/prerender.mjs`.
 * Como o primeiro processo encerrava com código 0 quando PRERENDER não estava
 * definido, o `&&` iniciava o prerender mesmo assim. Em bases com milhares de
 * rotas isso fazia o build ultrapassar o limite da plataforma.
 */
if (process.env.PRERENDER !== '1') {
  console.log('[postbuild] prerender ignorado (defina PRERENDER=1 para habilitar)');
  process.exit(0);
}

console.log('[postbuild] PRERENDER=1; iniciando prerender');
await import('./prerender.mjs');