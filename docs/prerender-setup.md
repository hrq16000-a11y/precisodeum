# Prerender — setup e execução

O prerender (`scripts/prerender.mjs`) sobe o `vite preview`, usa Chromium via
Playwright para visitar cada rota da lista em `scripts/generate-prerender-routes.mjs`
e grava o HTML hidratado em `dist/<rota>/index.html`. Roda automaticamente no
`postbuild`, então `npm run build` já dispara tudo.

## Variáveis de ambiente obrigatórias

`scripts/generate-prerender-routes.mjs` consulta o Supabase para descobrir
quais categorias/cidades/prestadores prerenderizar. Sem essas variáveis, a
geração de rotas falha:

| Variável | Origem | Onde já está documentada |
|----------|--------|--------------------------|
| `VITE_SUPABASE_URL` | URL pública do projeto Supabase | `.env` (gerado pelo Lovable Cloud) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave anon pública | `.env` (gerado pelo Lovable Cloud) |
| `VITE_SUPABASE_ANON_KEY` *(alternativa)* | Sinônimo aceito pelo script | opcional |

O script de build usa `node --env-file=.env`, então em ambiente local basta o
`.env` existir. Em CI, exponha as variáveis como secrets do workflow (veja
`.github/workflows/prerender-ci.yml`).

## Chromium

`scripts/prerender.mjs` lê `process.env.CHROMIUM_PATH` e, se ausente, cai em
`/bin/chromium-browser` (o caminho da imagem usada pelo Lovable).

| Ambiente | Caminho típico |
|----------|----------------|
| Lovable (build remoto) | `/bin/chromium-browser` (default — não precisa setar) |
| Ubuntu/Debian local | `/usr/bin/chromium-browser` ou `/usr/bin/chromium` |
| macOS (Homebrew) | `/Applications/Chromium.app/Contents/MacOS/Chromium` |
| Playwright CI | `node -e "console.log(require('playwright').chromium.executablePath())"` |

Para forçar outro caminho:

```bash
CHROMIUM_PATH=/usr/bin/chromium npm run build
```

Em CI usamos `npx playwright install --with-deps chromium` e depois resolvemos
o caminho via `require('playwright').chromium.executablePath()`.

## Variáveis opcionais do prerender

Constantes editáveis no topo de `scripts/prerender.mjs` (não são env vars):

- `PORT` (default `4173`) — porta do `vite preview`.
- `CONCURRENCY` (default `2`) — quantas páginas em paralelo.
- `TIMEOUT_STATIC` / `TIMEOUT_DYNAMIC` — quanto esperar pelo gate antes de
  declarar a rota como falha.

## Gate de hidratação (`data-seo-ready`)

Rotas dinâmicas (`/categoria/*`, `/cidade/*`, `/profissional/*`) precisam
emitir `data-seo-ready="true"` na raiz **somente após** os dados reais
carregarem (ver `src/pages/CategoryPage.tsx`, `CityPage.tsx`,
`ProviderProfile.tsx`). O prerender bloqueia em
`waitForFunction(() => document.querySelector('[data-seo-ready="true"]'))`
antes de capturar o HTML — sem isso, o `<title>` genérico do shell vazaria.

O teste `src/__tests__/seo-ready-marker.test.tsx` garante que o marcador
existe e depende das flags corretas.

## Validação pós-build

`scripts/validate-prerender.mjs` varre `dist/` e exige que rotas SEO-críticas
tenham `<title>` diferente do shell, `<meta description>` ≥10 chars e
`<link rel=canonical>`. Gera `dist/prerender-validation.json` e retorna exit
1 se houver páginas em fallback genérico.

```bash
node scripts/validate-prerender.mjs
```

## Execução local

```bash
# 1. .env já populado pelo Lovable Cloud
# 2. instale Chromium (se ainda não tiver)
npx playwright install --with-deps chromium
export CHROMIUM_PATH="$(node -e "console.log(require('playwright').chromium.executablePath())")"

# 3. build + prerender + validação
npm run build
node scripts/validate-prerender.mjs
```

## CI

Workflow `.github/workflows/prerender-ci.yml`:

- Roda `npm run build` capturando log completo em `prerender-output.txt`.
- Gera `prerender-summary.txt` com contagem de ✓/✗ e a lista de rotas que falharam.
- Roda `validate-prerender.mjs` para confirmar que as rotas SEO têm metadata real.
- Sobe artefatos (`prerender-output.txt`, `prerender-summary.txt`,
  `dist/prerender-validation.json`, `dist/**/index.html`) por 7 dias.

Secrets necessários no repo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
