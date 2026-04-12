

# Respeitar Flag `module_blog` em Toda a Plataforma

## Problema
O blog pode ser desativado no painel administrativo (`module_blog = false`), mas ele continua aparecendo no menu do Header, Footer, EmptyStateFallback e nas ações rápidas do admin.

## Solução
Consultar a flag `module_blog` via `useFeatureEnabled('module_blog')` ou `useSiteSettings()` em todos os pontos onde o blog aparece, e ocultar os links/seções quando desativado.

## Alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/components/Header.tsx` | Filtrar links de fallback que apontam para `/blog` quando `module_blog` está desativado |
| `src/components/Footer.tsx` | Filtrar fallback "Notícias" (`/blog`) quando `module_blog` está desativado |
| `src/components/EmptyStateFallback.tsx` | Ocultar botão "Notícias" (`/blog`) quando `module_blog` está desativado |
| `src/components/admin/AdminQuickActions.tsx` | Ocultar ação "Novo Post" (`/admin/blog`) quando `module_blog` está desativado |
| `src/pages/BlogPage.tsx` | Redirecionar para home se blog desativado |
| `src/pages/BlogPostPage.tsx` | Redirecionar para home se blog desativado |

## Lógica
Cada componente importa `useFeatureEnabled` e filtra condicionalmente:

```typescript
import { useFeatureEnabled } from '@/hooks/useSiteSettings';

const blogEnabled = useFeatureEnabled('module_blog');

// Filtrar arrays de links
const links = allLinks.filter(l => blogEnabled || !l.url.includes('/blog'));

// Ou condição direta
{blogEnabled && <BlogButton />}
```

## Resultado
- Blog desativado no painel → desaparece de menus, footer, fallbacks e ações rápidas
- Blog ativado → tudo funciona normalmente
- Rotas públicas `/blog` redirecionam para home quando desativado

