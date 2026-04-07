
## Sistema de Patrocinadores - Plano de Implementação

### Fase 1: Expansão do Banco de Dados
- Adicionar campos na tabela `sponsors`: `sponsor_type` (global/city/category), `logo_url`, `short_description`, `full_description`, `phone`, `whatsapp`, `external_link`, `linked_city`, `linked_category`, `badge_type`, `max_slots`
- Criar tabela `sponsor_slot_limits` para controle de escassez (max 1 global, 3 por cidade, 3 por categoria)
- Adicionar campo `plan_tier` (basic/highlight/premium) para preparação de monetização

### Fase 2: Componentes Visuais (Frontend)
- Criar `SponsorPremiumCard` — card de alta conversão com logo, selo, frase de impacto, botões WhatsApp/Ver mais, animações fade+slide
- Criar `SponsorScarcityBadge` — exibição de "Restam X vagas"
- Criar `SponsorTopBanner` — bloco topo premium
- Criar `SponsorMidContent` — inserção entre listagens
- Criar `SponsorSidebarWidget` — sidebar desktop fixa
- Criar `SponsorFooterCTA` — bloco reforço final

### Fase 3: Exibição Inteligente
- Integrar componentes nas páginas existentes (Home, Categoria, Cidade, Perfil) sem alterar rotas
- Filtragem automática por tipo (global aparece em tudo, cidade/categoria filtrado)
- Lazy loading e carregamento progressivo

### Fase 4: Dashboard do Patrocinador
- Expandir painel sponsor com métricas: views, cliques, WhatsApp, taxa de conversão, ranking
- Gráficos leves com Recharts

### Fase 5: Admin - Gestão Completa
- Expandir página admin de sponsors com CRUD completo dos novos campos
- Controle de limites por contexto
- Sistema de expiração visual

### Fase 6: Tracking e SEO
- Expandir tracking existente para novos eventos
- Schema.org LocalBusiness para patrocinadores
- UTM automática nos links
