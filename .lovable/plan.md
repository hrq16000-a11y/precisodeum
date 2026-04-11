

# Melhorias Significativas: Admin + Dashboard

## Resumo

Melhorias em navegação, organização, controles e recursos visuais em ambos os painéis (admin e dashboard do usuário), com foco em UX, produtividade e informação contextual.

---

## 1. Admin: Header Contextual com Busca Global + Atalhos

**Problema**: O admin não tem header fixo no desktop -- apenas breadcrumb inline. Falta busca global visível.

**Solução**: Criar header fixo no desktop com:
- Breadcrumb animado (grupo > página)
- Busca global com Command Palette (Cmd+K) que busca em menus E dados (providers, users)
- Botão de notificações com badge
- Avatar do admin com dropdown (perfil, site, sair)

| Arquivo | Alteração |
|---|---|
| `src/components/AdminLayout.tsx` | Adicionar header desktop fixo com busca, notificações e avatar |

---

## 2. Admin: Cards de KPI no Topo com Sparklines

**Problema**: A página principal do admin (`AdminPage`) tem stats mas sem contexto de tendência.

**Solução**: Adicionar mini sparklines (últimos 7 dias) nos stat cards usando dados já carregados pelo `AdminGrowthChart`. Criar componente `AdminKpiBar` que mostra 4 KPIs principais (Usuários, Prestadores Pendentes, Leads Hoje, Receita MRR) em formato compacto com indicadores de tendência (seta verde/vermelha).

| Arquivo | Alteração |
|---|---|
| `src/components/admin/AdminKpiBar.tsx` | Novo componente com 4 KPIs + tendência |
| `src/pages/AdminPage.tsx` | Integrar `AdminKpiBar` no topo |

---

## 3. Dashboard: Barra de Status do Perfil Fixa

**Problema**: A barra de progresso do perfil fica enterrada na sidebar. O profissional não tem visibilidade constante.

**Solução**: Adicionar mini status bar abaixo do header mobile no dashboard (apenas provider, apenas se < 100%) com progresso visual e link direto para completar.

| Arquivo | Alteração |
|---|---|
| `src/components/DashboardLayout.tsx` | Adicionar `ProfileStatusStrip` condicional |

---

## 4. Dashboard: Grid de Stats Responsivo Melhorado

**Problema**: StatCardGrid usa `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` — fica comprimido em mobile.

**Solução**: Redesenhar para `grid-cols-2 sm:grid-cols-3` com cards maiores, ícones mais expressivos, e micro-animação de "pulse" no card com maior valor. Adicionar tooltips com contexto (ex: "Leads nos últimos 30 dias").

| Arquivo | Alteração |
|---|---|
| `src/components/dashboard/StatCardGrid.tsx` | Redesenhar layout responsivo + tooltips |

---

## 5. Admin: Sidebar com Favoritos/Atalhos Personalizáveis

**Problema**: Com 40+ itens no menu, navegação é lenta.

**Solução**: Adicionar seção "Favoritos" no topo da sidebar do admin. O admin pode clicar numa estrela ao lado de qualquer item para fixá-lo. Persistido no `localStorage`.

| Arquivo | Alteração |
|---|---|
| `src/components/AdminLayout.tsx` | Adicionar seção Favoritos no topo da sidebar com drag-reorder |

---

## 6. Dashboard: Onboarding Stepper Visual Redesenhado

**Problema**: O guia "Como funciona" é um accordion com steps lineares — funciona mas não é visualmente atrativo.

**Solução**: Transformar em um stepper horizontal compacto com ícones circulares conectados por linha de progresso animada. Steps concluídos ficam preenchidos, pendentes ficam outline.

| Arquivo | Alteração |
|---|---|
| `src/pages/DashboardPage.tsx` | Redesenhar seção de onboarding como stepper visual |

---

## 7. Admin + Dashboard: Tema de Cores por Seção

**Problema**: Todas as seções têm a mesma aparência — dificulta orientação visual.

**Solução**: Adicionar cor de destaque sutil por grupo no admin (Gestão=azul, Conteúdo=verde, Comercial=roxo, Sistema=cinza). No dashboard, manter accent principal mas diferenciar cards por categoria funcional.

| Arquivo | Alteração |
|---|---|
| `src/components/admin/AdminGroupNav.tsx` | Adicionar indicador de cor por grupo |
| `src/components/AdminLayout.tsx` | Sidebar com cor sutil por seção ativa |

---

## 8. Dashboard: Widget de Ações Pendentes

**Problema**: O dashboard mostra stats mas não diz ao profissional "o que fazer agora".

**Solução**: Criar componente `ActionQueue` que lista ações pendentes em ordem de prioridade:
- Leads não respondidos (urgente)
- Perfil incompleto
- Serviços sem imagem
- Avaliações para responder

Com ícone de urgência e link direto para resolver.

| Arquivo | Alteração |
|---|---|
| `src/components/dashboard/ActionQueue.tsx` | Novo componente de fila de ações |
| `src/pages/DashboardPage.tsx` | Integrar entre WelcomeHero e Stats |

---

## 9. Admin: Notificações Inline na Sidebar

**Problema**: Itens com pendências (ex: Prestadores com 5 pendentes) não mostram badge na sidebar.

**Solução**: Adicionar badges dinâmicos nos itens da sidebar do admin para: Prestadores (pendentes), Vagas (pendentes), Leads (novos), Avaliações (moderação).

| Arquivo | Alteração |
|---|---|
| `src/components/AdminLayout.tsx` | Badges dinâmicos por item de menu |

---

## 10. Transições de Página Suaves

**Problema**: As transições entre páginas já existem mas são básicas (fade+slide).

**Solução**: Melhorar com `AnimatePresence` shared layout animations nos cards de navegação e adicionar efeito de "morph" nos breadcrumbs ao mudar de grupo.

| Arquivo | Alteração |
|---|---|
| `src/components/AdminLayout.tsx` | Breadcrumb com `layoutId` para morph |
| `src/components/DashboardLayout.tsx` | Transição de conteúdo mais fluida |

---

## Arquivos Total

| Componente | Tipo |
|---|---|
| `src/components/admin/AdminKpiBar.tsx` | Novo |
| `src/components/dashboard/ActionQueue.tsx` | Novo |
| `src/components/AdminLayout.tsx` | Atualizado (header desktop, favoritos, badges, transições) |
| `src/components/DashboardLayout.tsx` | Atualizado (status strip, transições) |
| `src/components/admin/AdminGroupNav.tsx` | Atualizado (cores por grupo) |
| `src/components/dashboard/StatCardGrid.tsx` | Atualizado (responsive + tooltips) |
| `src/pages/AdminPage.tsx` | Atualizado (KPI bar) |
| `src/pages/DashboardPage.tsx` | Atualizado (action queue, stepper) |

Nenhuma mudança de banco de dados. Tudo client-side com dados já disponíveis.

