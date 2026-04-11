

## Plano: Integrar componentes premium no ProviderProfile, ProviderCard e FeaturedProviders

### Estado atual
Os 5 componentes ja foram criados na iteracao anterior (ProfileBadge, ReviewSummary, TestimonialsCarousel, ConversionTags, TrustGuarantee). Falta integrá-los nos 3 arquivos principais. Os componentes ja respeitam as regras de negocio (sem "Identidade Verificada", sem escudo verde, usando Handshake e "Negociacao Direta").

### Alteracoes

**1. `src/pages/ProviderProfile.tsx`** — Integrar todos os componentes

- Adicionar imports: `ReviewSummary`, `ProfileBadge`, `ConversionTags`, `TrustGuarantee`, `TestimonialsCarousel`, `getRankTier` (de ReviewSummary)
- **Linha ~1027-1031**: Substituir `StarRating` no header por `ReviewSummary` (versao full com ranking badge)
- **Linha ~1033-1050**: Substituir o bloco `TrustBadge` por `ProfileBadge` (usa `hasOwnAvatar` e `services.length > 0`), mantendo badges de "Experiente" e "Responde em X"
- **Linha ~1093-1094**: Apos Stats Mini Cards, adicionar `ConversionTags` com `reviewCount` e `responseTime`
- **Linha ~1136**: Apos CTA buttons, adicionar microcopy: "Orcamento sem compromisso. Fale direto com o profissional."
- **Linha ~892-897**: No `sectionMap`, adicionar `testimonials: renderTestimonials` que renderiza `TestimonialsCarousel` com `reviews`
- Apos `renderAbout`, inserir `TrustGuarantee`
- Renomear "Portfolio" para "Trabalhos Realizados" (linhas ~721 e ~785)
- Confirmar que WhatsApp com deep link (`whatsappLink`) ja esta integrado nos CTAs (ja esta — linhas 1116, 1344)

**2. `src/components/ProviderCard.tsx`** — Badges e microcopy

- Adicionar imports: `ProfileBadge`, `ReviewSummary` (compact), `getRankTier`
- Substituir badge "Verificado" (linha ~131) por `ProfileBadge size="sm"`
- Adicionar ranking badge (Ouro/Prata/Bronze) via `getRankTier` ao lado do nome
- Adicionar microcopy "Orcamento sem compromisso" em `text-[10px]` abaixo dos botoes CTA

**3. `src/components/home/FeaturedProviders.tsx`** — Mesmo tratamento

- Adicionar imports: `ProfileBadge`, `getRankTier`
- Na funcao `ProviderCardFeatured`, adicionar ranking badge e `ProfileBadge` compacto
- Adicionar microcopy abaixo dos botoes

### Confirmacoes
- WhatsApp com deep link `whatsapp://send?phone=...` ja esta implementado via `whatsappLink()` em `src/lib/whatsapp.ts` — mantido em toda a hierarquia
- Nenhum termo de "Identidade Verificada" ou "Contratacao Segura" sera usado
- ProfileBadge usa cores accent (laranja da marca), nao verde-escudo
- TrustGuarantee usa icone Handshake com texto "Negociacao Direta"

### Arquivos modificados
- `src/pages/ProviderProfile.tsx`
- `src/components/ProviderCard.tsx`
- `src/components/home/FeaturedProviders.tsx`

