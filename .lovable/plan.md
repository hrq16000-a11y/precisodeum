

## Plano: Indexação 100% — Buscadores, Chatbots e IAs

### Problema atual

O site é uma SPA (React) que renderiza todo o conteúdo via JavaScript. Crawlers tradicionais (Google, Bing) conseguem executar JS, mas **chatbots de IA** (ChatGPT, Perplexity, Claude, etc.) e alguns crawlers secundários **não executam JavaScript** — eles leem apenas o HTML estático inicial, que hoje está praticamente vazio (`<div id="root"></div>`).

Além disso, faltam sinais padronizados para IAs: `llms.txt`, headers de permissão e meta tags específicas.

### O que será feito

#### 1. Arquivo `public/llms.txt` — Guia para IAs
Criar um arquivo padrão `llms.txt` (proposta em adoção por ChatGPT, Perplexity e outros) na raiz do site com:
- Nome e descrição do site
- URLs principais e estrutura de conteúdo
- Instruções de como navegar o site
- Links para sitemap e categorias

#### 2. Arquivo `public/.well-known/ai-plugin.json`
Criar manifesto padrão para plugins de IA com metadados do site, facilitando descoberta por agentes.

#### 3. Meta tags para crawlers de IA no `index.html`
Adicionar ao `<head>`:
- `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">` — permissões máximas
- `<meta name="ai-content-declaration" content="human-created">` — declaração de conteúdo
- Tags Open Graph adicionais (`og:locale`, `og:url`)

#### 4. Atualizar `robots.txt` para incluir crawlers de IA
Adicionar regras explícitas para:
- `GPTBot` (ChatGPT)
- `ChatGPT-User`
- `Google-Extended` (Gemini/Bard)
- `PerplexityBot`
- `ClaudeBot` (Anthropic)
- `Bytespider` (TikTok)
- `CCBot` (Common Crawl)
- Referência ao `llms.txt`

#### 5. Sitemap: adicionar páginas estáticas faltantes
Atualizar a edge function `sitemap` para incluir:
- `/blog` e posts individuais (`/blog/:slug`)
- `/faq`, `/servicos`, `/cidades`, `/categorias`
- `/vagas` e vagas individuais
- `/privacidade`, `/termos`, `/cookies`
- Páginas institucionais (`/p/:slug`)

#### 6. SSR-like: Noscript fallback no `index.html`
Adicionar dentro de `<noscript>` no `<body>` um bloco com texto descritivo do site, links para categorias e informações básicas. Isso garante que crawlers que não executam JS encontrem **conteúdo textual real** em vez de uma página vazia.

#### 7. JSON-LD global no `index.html`
Adicionar schema `WebSite` e `Organization` diretamente no HTML estático (não dependendo de JS) para que crawlers vejam dados estruturados imediatamente.

### Arquivos modificados/criados

| Arquivo | Ação |
|---|---|
| `public/llms.txt` | Criar |
| `public/.well-known/ai-plugin.json` | Criar |
| `public/robots.txt` | Atualizar |
| `index.html` | Atualizar (meta tags, noscript, JSON-LD) |
| `supabase/functions/sitemap/index.ts` | Atualizar (mais URLs) |

### Detalhes técnicos

- O `llms.txt` segue a especificação emergente usada por ChatGPT Browse e Perplexity
- O noscript fallback não afeta usuários normais (só aparece sem JS)
- O JSON-LD estático no HTML é duplicado propositalmente — crawlers sem JS o leem do HTML, crawlers com JS o atualizam via React
- O sitemap passa a cobrir ~100% das rotas públicas do site

