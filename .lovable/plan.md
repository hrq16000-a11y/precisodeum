
# Plano de Melhorias Significativas — Estrutura Completa

## 1. Permissões Baseadas em Nível (Rotas + Perfil Público)
- Criar hook `usePermissions` que lê as permissões do `user_levels` do usuário logado
- Aplicar verificação de permissões nas rotas admin (ex: se não tem `manage_settings`, não acessa `/admin/configuracoes`)
- Exibir badge de Nível e Tipo de Conta no perfil público do profissional (`ProviderProfile`)
- Admin Layout: ocultar itens do menu baseado nas permissões do nível

## 2. Dashboard do Usuário — Métricas e Ações Rápidas
- Adicionar cards de KPI no dashboard (total de visualizações, leads recebidos, avaliações)
- Gráfico de leads/visualizações nos últimos 30 dias
- Ações rápidas: editar perfil, gerenciar serviços, ver leads pendentes
- Indicador de completude do perfil com checklist visual

## 3. Gestão de Portfólio e Serviços (Sincronização)
- Melhorar o wizard de serviços com preview em tempo real
- Adicionar gestão de imagens do portfólio diretamente no dashboard com drag-to-reorder
- Sincronizar contagem de serviços/fotos entre perfil e dashboard
- Validação visual de limites (ex: 20 fotos max com barra de progresso)

## 4. Configurações de Página do Profissional
- Melhorar DashboardMyPagePage com preview do tema selecionado
- Permitir personalizar cores, headline, tagline e redes sociais
- Mostrar preview live da página pública

## 5. Performance & SEO
- Adicionar meta tags dinâmicas no perfil do profissional (og:image, description)
- JSON-LD para profissionais (LocalBusiness schema)
- Lazy loading de imagens do portfólio com intersection observer

## 6. UX/Design do Admin
- Melhorar cards de níveis e tipos de conta com visual mais rico
- Adicionar contadores de uso (quantos usuários em cada nível/tipo)
