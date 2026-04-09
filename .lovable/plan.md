

## Auditoria Completa — Cobertura do Painel Administrativo

### Metodologia
Cruzamento de todas as 49 tabelas do banco de dados com as 39 páginas administrativas, verificando cobertura CRUD, presença no menu de navegação e funcionalidade de backup/exportação.

---

### Resultado Geral: 92% de cobertura

O painel administrativo cobre a grande maioria das tabelas e funcionalidades. Foram identificadas **4 lacunas** que precisam de correção:

---

### LACUNAS ENCONTRADAS

#### 1. `sponsor_leads` — SEM página admin (CRÍTICO)
- Leads de patrocinadores submetidos via `/quero-ser-patrocinador` são inseridos na tabela `sponsor_leads`, mas **não existe nenhuma página administrativa** para visualizar, gerenciar ou responder esses leads comerciais.
- **Impacto**: O admin não tem como ver quem quer ser patrocinador.
- **Solução**: Criar página `/admin/leads-patrocinadores` com listagem, filtros por status, edição e ações (aprovar, rejeitar, contactar).

#### 2. `neighborhoods` (Bairros) — CRUD ausente
- A tabela `neighborhoods` é referenciada na página de Cidades apenas como **contagem** (quantos bairros cada cidade tem), mas não existe interface para **criar, editar ou excluir bairros**.
- **Impacto**: Bairros só podem ser gerenciados via banco de dados direto.
- **Solução**: Adicionar aba "Bairros" dentro de `/admin/cidades` com CRUD completo (nome, slug, cidade vinculada).

#### 3. `sponsor_slot_limits` — SEM gestão admin
- A tabela existe no banco mas não é referenciada em nenhuma página admin.
- **Impacto**: Limites de slots por posição/cidade não são gerenciáveis.
- **Solução**: Integrar gestão de limites dentro de `/admin/slots-anuncios` como seção ou aba.

#### 4. `subscriptions` — SEM página admin dedicada
- A tabela `subscriptions` (assinaturas de prestadores) aparece apenas no backup, mas não possui tela para visualizar ou gerenciar assinaturas ativas/expiradas.
- **Impacto**: Sem visibilidade do status de pagamento dos prestadores.
- **Solução**: Criar página `/admin/assinaturas` ou integrar como aba em `/admin/prestadores`.

---

### O QUE ESTÁ 100% COBERTO (35 tabelas/funcionalidades)

| Tabela | Página Admin | CRUD |
|---|---|---|
| `profiles` | `/admin/usuarios` + `/admin/crm-usuarios` | Leitura, Edição, Permissões, Reset senha |
| `providers` | `/admin/prestadores` | CRUD + Aprovação + Bulk |
| `services` | `/admin/servicos` | CRUD completo |
| `service_categories` | Gerenciado via serviços | Automático |
| `service_images` | Gerenciado via serviços | Automático |
| `leads` | `/admin/leads` | CRUD + Filtros |
| `reviews` | `/admin/avaliacoes` | CRUD + Moderação |
| `categories` | `/admin/categorias` | CRUD completo |
| `cities` | `/admin/cidades` | CRUD + Import + Bulk |
| `jobs` | `/admin/vagas` | CRUD + Aprovação |
| `blog_posts` | `/admin/blog` | CRUD + Publicação |
| `faqs` | `/admin/faq` | CRUD completo |
| `highlights` | `/admin/destaques` | CRUD completo |
| `popular_services` | `/admin/servicos-populares` | CRUD completo |
| `community_links` | `/admin/comunidade` | CRUD completo |
| `hero_banners` | `/admin/hero-banners` | CRUD + Agendamento |
| `sponsors` | `/admin/patrocinadores` | CRUD + Métricas |
| `sponsor_contacts` | `/admin/patrocinadores` | CRUD + Permissões |
| `sponsor_campaigns` | `/admin/patrocinadores` + `/admin/crm-patrocinadores` | CRUD |
| `sponsor_contracts` | `/admin/patrocinadores` + `/admin/crm-patrocinadores` | CRUD |
| `sponsor_notes` | `/admin/patrocinadores` + `/admin/crm-patrocinadores` | CRUD |
| `sponsor_metrics` | `/admin/patrocinadores` (métricas) | Leitura |
| `ad_slots` | `/admin/slots-anuncios` | CRUD completo |
| `ad_slot_assignments` | `/admin/slots-anuncios` | CRUD completo |
| `page_blocks` | `/admin/blocos` | CRUD completo |
| `institutional_pages` | `/admin/paginas` | CRUD completo |
| `menu_items` | `/admin/menus` | CRUD + Reordenar |
| `home_steps` | `/admin/como-funciona` | CRUD completo |
| `home_testimonials` | `/admin/depoimentos` | CRUD completo |
| `home_cta_blocks` | `/admin/cta-blocos` | CRUD completo |
| `site_settings` | `/admin/configuracoes` | Edição completa |
| `profile_type_settings` | `/admin/tipos-conta` | CRUD completo |
| `account_types` | `/admin/tipos-conta` | CRUD completo |
| `tier_rules` | `/admin/regras` | CRUD completo |
| `user_levels` | `/admin/niveis` | CRUD completo |
| `user_roles` | `/admin/usuarios` | Edição |
| `plan_resources` | `/admin/regras` | CRUD completo |
| `user_tags` | `/admin/crm-usuarios` | CRUD completo |
| `media` | `/admin/midia` | Biblioteca + Bulk |
| `audit_log` | `/admin/auditoria` | Leitura |
| `pwa_install_settings` | `/admin/pwa` | Edição |
| `pwa_install_events` | `/admin/pwa` | Leitura |
| `notifications` | Dashboard (usuário) | Automático |
| `push_subscriptions` | Sistema | Automático |
| `provider_page_settings` | Dashboard (prestador) | Automático |

---

### TABELAS AUXILIARES (sem necessidade de admin dedicado)
- `sponsor_notifications` — gerenciadas pelo painel do patrocinador
- `sponsor_metrics` — dados automáticos de tracking

---

### Plano de Correção

#### Arquivos a criar/editar:

1. **Criar `src/pages/AdminSponsorLeadsPage.tsx`** — CRUD completo para `sponsor_leads` com filtros (status, data), edição inline e ações de contato
2. **Editar `src/pages/AdminCitiesPage.tsx`** — Adicionar aba "Bairros" com CRUD para `neighborhoods` (criar, editar, excluir, vincular a cidade)
3. **Editar `src/pages/AdminAdSlotsPage.tsx`** — Adicionar seção de gestão de `sponsor_slot_limits`
4. **Criar `src/pages/AdminSubscriptionsPage.tsx`** — Listagem de assinaturas com filtros por status e prestador
5. **Editar `src/App.tsx`** — Adicionar rotas `/admin/leads-patrocinadores` e `/admin/assinaturas`
6. **Editar `src/components/admin/AdminGroupNav.tsx`** e **`src/components/AdminLayout.tsx`** — Adicionar os novos itens no menu de navegação

### Detalhes técnicos
- Todas as novas páginas seguirão o padrão existente: `useAdmin()` para verificação de acesso, `AdminLayout` como wrapper, `useQuery`/`useMutation` para dados, `logAuditAction` para auditoria, `BulkActionsBar` para ações em massa
- Nenhuma tabela ou schema existente será alterada
- Novas rotas serão adicionadas sem impacto nas existentes

