

## Plano: Sitemap e Robots.txt funcionando

### Problema
- A edge function do sitemap **já funciona** (testei agora, retorna status 200 com XML completo)
- O `robots.txt` aponta para `https://precisodeum.com.br/sitemap.xml`, que não existe (404)
- Precisamos conectar os dois

### Solução

**1. Atualizar `robots.txt`** para apontar para a URL real da edge function:
```
Sitemap: https://qaftogrqeyymewoofexc.supabase.co/functions/v1/sitemap
```

**2. Criar rota `/sitemap.xml` no app** que redireciona automaticamente para a edge function — assim, se alguém acessar `precisodeum.com.br/sitemap.xml` diretamente, será redirecionado para o sitemap real. Isso será feito com um componente React simples que faz `window.location.replace()` para a URL da edge function.

**3. Adicionar a rota no `App.tsx`:**
```
/sitemap.xml → SitemapRedirect
```

### Resultado
- Google e outros buscadores conseguirão ler o sitemap via `robots.txt`
- Acesso direto a `/sitemap.xml` também funcionará via redirect
- Nenhuma alteração na edge function necessária (já está OK)

