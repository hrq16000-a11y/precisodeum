

# Evolucao de Aperfeicoamentos — Plataforma Completa

## Resumo

Melhorias visuais, interativas e de UX em 4 frentes: Home, Admin, Dashboard do Prestador e Paginas de Listagem. Foco em polish premium, micro-interacoes e consistencia visual.

---

## 1. Home — Secoes com Visual Premium

**PopularServices**: Adicionar `motion` com stagger nos cards, efeito de gradient-sweep no hover, e badge animado "Mais procurado" no primeiro item.

**TestimonialsSection**: Implementar auto-play com swipe (timer de 5s), transicao com `AnimatePresence` entre paginas, e avatar com gradiente dinamico baseado no rating.

**HowItWorksSection**: Adicionar animacao de conexao sequencial (linha que "desenha" progressivamente entre os passos usando motion path), e efeito de pulse no step ativo.

**FaqSection**: Melhorar a transicao do accordion com spring animation em vez de max-height CSS, e adicionar icone de categoria nas perguntas quando disponivel.

**Footer**: Redesenhar com grid mais limpo, adicionar efeito de hover nos links do ecossistema (underline animado), badge "Novo" nos links recentes, e animacao de entrada suave ao entrar no viewport.

---

## 2. Dashboard do Prestador — Metricas e Engajamento

**Stat Cards 3D**: Aprimorar os cards com efeito de reflexo (shine sweep) mais pronunciado e tooltip com tendencia (ex: "+12% esta semana").

**Quick Actions Bar**: Criar uma barra de acoes rapidas no topo do dashboard com botoes: "Criar Servico", "Ver Minha Pagina", "Responder Leads" — com contadores em tempo real.

**Welcome Banner Inteligente**: Mostrar mensagem contextual baseada na hora do dia e status do perfil (ex: "Boa noite! Voce tem 3 leads pendentes").

**Sidebar Enhancement**: Adicionar contador de notificacoes nao lidas no item "Notificacoes" e badge de leads pendentes no item "Leads".

---

## 3. Painel Admin — UX e Navegabilidade

**Sidebar Search**: Adicionar campo de busca rapida no topo da sidebar admin para filtrar itens do menu instantaneamente.

**Breadcrumb Automatico**: Adicionar breadcrumb no topo do conteudo principal baseado na rota atual e nos grupos do menu.

**Quick Stats no Header**: Mostrar mini-badges com contadores (total usuarios, prestadores pendentes, leads hoje) no header mobile do admin.

---

## 4. Paginas de Listagem — Cards e Filtros

**CategoriesListPage**: Adicionar animacoes de entrada staggered com `motion`, badge com contagem de prestadores, e hover com preview de subcategorias.

**ServicesPage**: Implementar grid animado com `layout` transitions ao filtrar, empty state mais visual com ilustracao, e skeleton com shimmer effect.

**MobileBottomNav**: Adicionar indicador ativo animado (dot ou pill que se move entre os itens com `layoutId`), e haptic-like scale feedback no toque.

---

## Detalhes Tecnicos

- Todas as animacoes usam `framer-motion` (ja instalado)
- Componentes existentes como `FadeInSection`, `GlassCard`, `AnimatedCounter` serao reutilizados
- Nenhuma nova dependencia necessaria
- Nenhuma alteracao de banco de dados
- Nenhuma alteracao de rotas

### Arquivos a modificar:
- `src/components/home/PopularServices.tsx`
- `src/components/home/TestimonialsSection.tsx`
- `src/components/home/HowItWorksSection.tsx`
- `src/components/home/FaqSection.tsx`
- `src/components/Footer.tsx`
- `src/pages/DashboardPage.tsx`
- `src/components/DashboardLayout.tsx`
- `src/components/AdminLayout.tsx`
- `src/pages/CategoriesListPage.tsx`
- `src/pages/ServicesPage.tsx`
- `src/components/MobileBottomNav.tsx`

