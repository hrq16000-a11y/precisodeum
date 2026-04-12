

# Upgrade de Inteligência e Conversão

## 1. WhatsApp Smart-Link (mensagem estruturada)

O `ProviderCard` (linha 232) já tem uma mensagem contextual com nome e categoria. Vamos melhorar para incluir bairro/cidade do usuário e a categoria do profissional de forma mais natural.

**Arquivos:** `src/components/ProviderCard.tsx`, `src/pages/ServiceDetailPage.tsx`, `src/components/home/FeaturedProviders.tsx`

- Padronizar a mensagem em todos os pontos de contato WhatsApp:
  ```
  Olá {Nome}! Vi seu perfil no Preciso de Um. Preciso de ajuda com {Categoria}. Minha localização aproximada é {Bairro/Cidade}. Podemos conversar?
  ```
- Usar `geoCity` e neighborhood do hook `useGeoCity` para preencher a localização do usuário automaticamente
- Criar helper `buildSmartMessage()` em `src/lib/whatsapp.ts` para centralizar a lógica

## 2. Contador de Profissionais Ativos na Cidade

**Novo componente:** `src/components/home/ActiveProvidersCounter.tsx`

- Query em `providers` filtrando `status = 'approved'` e `city = geoCity`
- Exibir: "🟢 **25** profissionais prontos para te atender em **Curitiba** agora"
- Usar `AnimatedCounter` existente para animação do número
- Posicionar logo abaixo do hero na home e nas páginas de categoria
- Se não houver geolocalização, mostrar o total geral da plataforma

## 3. Skeleton Loading Profissional

**Novo componente:** `src/components/ProviderCardSkeleton.tsx`

- Skeleton que replica exatamente o layout do `ProviderCard`: avatar circular, linhas de texto, badges, botões
- Substituir os `<Skeleton className="h-72" />` genéricos em `FeaturedProviders` (linha 74), `CategoryPage`, e `SearchPage`
- Também criar skeleton para o `ProviderCardFeatured` dentro de `FeaturedProviders`

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/whatsapp.ts` | Novo `buildSmartMessage()` |
| `src/components/ProviderCard.tsx` | Usar `buildSmartMessage` |
| `src/components/home/FeaturedProviders.tsx` | Usar `buildSmartMessage` + skeleton |
| `src/pages/ServiceDetailPage.tsx` | Usar `buildSmartMessage` |
| `src/components/home/ActiveProvidersCounter.tsx` | **Novo** — contador dinâmico |
| `src/components/ProviderCardSkeleton.tsx` | **Novo** — skeleton realista |
| `src/pages/Index.tsx` | Incluir `ActiveProvidersCounter` |
| `src/pages/CategoryPage.tsx` | Incluir `ActiveProvidersCounter` + skeleton |
| `src/pages/SearchPage.tsx` | Usar skeleton |

