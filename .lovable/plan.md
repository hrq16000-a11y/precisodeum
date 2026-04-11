
Objetivo: restaurar definitivamente a exibição dos profissionais na Home, na busca e nas páginas de categoria, corrigindo a causa real da regressão e blindando o app contra novas quedas.

## Diagnóstico confirmado

A última mudança em `src/lib/searchSanitizer.ts` não é a causa principal deste problema.

A causa real está no backend + fallback de listagem:

1. A query pública de `providers` está retornando dados normalmente.
2. A query pública de `public_profiles` no preview está retornando `200` com `[]`.
3. O motivo é a migration `supabase/migrations/20260410215419_01cf2709-8d77-42a5-a7dc-d526bf4fb028.sql`, que mudou `public.public_profiles` para `security_invoker = true`.
4. Só que a tabela base `profiles` não tem política pública de leitura e contém PII. Resultado: a view pública deixa de devolver nomes/avatares para visitantes.
5. Em `src/hooks/useProviders.tsx`, o filtro de incompletos depende de `profileName` vindo dessa view:
   - `isIncomplete = !profileName || !city`
   - com `incomplete_profile_hide_public = true`, isso pode zerar Home, busca e categorias ao mesmo tempo.

## Plano de correção

### 1. Corrigir a view pública de perfis no banco
Criar uma migration para reverter apenas `public.public_profiles` para o modo seguro que funciona para visitantes:
- voltar `public_profiles` para `security_invoker = false`
- manter `GRANT SELECT` na view pública
- não abrir `SELECT` público na tabela `profiles`

Importante:
- `profiles` tem email, telefone, whatsapp e permissões
- portanto, a correção deve ser na view pública, não na tabela base

### 2. Blindar `useProviders.tsx` para não derrubar tudo se a view falhar
Ajustar `src/hooks/useProviders.tsx` para que a visibilidade pública nunca dependa exclusivamente de `public_profiles`.

Vou trocar a regra de completude para usar o nome efetivo do card:
```text
displayName = profile.full_name || business_name || slug
isIncomplete = !displayName || !city
```

Também vou tratar lookup vazio/erro de `public_profiles` como fallback visual, não como motivo para esconder providers.

### 3. Unificar a regra pública entre Home, busca e categorias
Hoje a regra de “provider visível ao público” está espalhada.

Vou centralizar isso em um helper interno reutilizável, para que:
- `useFeaturedProviders`
- `useSearchProviders`
- `useCategoryProviders`
- contagem de categorias

usem exatamente a mesma regra de visibilidade.

Assim evitamos:
- categoria com contador > 0 e página vazia
- Home zerada enquanto o banco tem providers aprovados
- busca e listagem divergindo entre si

### 4. Alinhar os contadores de categorias com a visibilidade real
`useCategoriesWithCount()` hoje conta apenas `status='approved'`, sem aplicar a mesma regra pública da listagem.

Vou ajustar para contar apenas providers realmente exibíveis ao visitante, para que:
- categorias com profissionais apareçam corretamente
- categorias sem profissional visível não enganem o usuário

### 5. Auditar os outros consumidores de `public_profiles`
Há outros pontos que dependem dessa view. Vou revisar os consumidores públicos mais sensíveis para garantir fallback seguro se o nome/avatar não vier:
- `src/pages/PopularServicePage.tsx`
- `src/pages/ServiceDetailPage.tsx`
- `src/pages/ProviderProfile.tsx`
- `src/pages/CityPage.tsx`
- `src/pages/SeoPage.tsx`

Objetivo:
- nome e avatar podem degradar
- mas a listagem nunca pode sumir por causa disso

## Arquivos a ajustar

| Arquivo | Alteração |
|---|---|
| `supabase/migrations/*.sql` | Reverter `public.public_profiles` para `security_invoker = false` com acesso público só pela view |
| `src/hooks/useProviders.tsx` | Fallback seguro de nome, regra de completude robusta e helper unificado de visibilidade |
| `src/pages/PopularServicePage.tsx` | Fallback defensivo para nome/avatar |
| `src/pages/ServiceDetailPage.tsx` | Fallback defensivo para nome/avatar |
| `src/pages/ProviderProfile.tsx` | Validar dependência da view pública |
| `src/pages/CityPage.tsx` | Fallback defensivo se necessário |
| `src/pages/SeoPage.tsx` | Evitar quebra de nome em páginas SEO |

## Resultado esperado após a correção

Depois dessa correção:

- Home volta a exibir profissionais em destaque
- busca volta a listar profissionais normalmente
- páginas de categoria voltam a mostrar os profissionais cadastrados
- categorias passam a refletir a disponibilidade real
- os 14 perfis realmente incompletos continuam ocultos
- os demais providers aprovados voltam a aparecer
- o selo DESTAQUE continua independente da visibilidade e segue a lógica OR já corrigida

## Detalhe técnico

```text
Hoje:
providers = OK
public_profiles = []
hide_incomplete = true
isIncomplete depende de profileName
=> quase tudo some

Após correção:
public_profiles volta a responder
+
completude usa fallback seguro (full_name || business_name || slug)
=> Home, busca e categorias deixam de zerar
```
