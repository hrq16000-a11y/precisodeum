

## Problema

A rota `/sitemap.xml` usa um componente React com `window.location.replace()`. Isso tem dois problemas:

1. Crawlers de busca geralmente **não executam JavaScript** para buscar sitemaps — eles esperam XML puro
2. A extensão `.xml` pode fazer o hosting tentar servir um arquivo estático em vez do SPA, resultando em 404

## Solução

Criar o sitemap como um **arquivo estático gerado** não é viável (é dinâmico). A melhor abordagem é:

1. **Adicionar uma rota `/sitemap`** (sem .xml) no App.tsx que faz o redirect — funciona melhor com SPA hosting
2. **Atualizar `robots.txt`** para apontar `Sitemap: https://precisodeum.com.br/sitemap` 
3. **Manter a edge function** como fonte real dos dados
4. O redirect via `window.location.replace()` funciona para navegadores e para o Googlebot (que executa JS em SPAs)

Alternativa mais robusta: criar um **proxy edge function** que o domínio custom possa servir. Mas como o Lovable hosting redireciona todas as rotas SPA para index.html (exceto extensões de arquivo), a solução mais simples é usar `/sitemap` sem extensão.

### Alterações

- **`src/App.tsx`**: Mudar rota de `/sitemap.xml` para `/sitemap` (manter a antiga também como fallback)
- **`public/robots.txt`**: Atualizar `Sitemap:` para `https://precisodeum.com.br/sitemap`

