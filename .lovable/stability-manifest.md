# 🔒 Manifesto de Estabilidade — Plataforma Preciso de Um

**Data de blindagem:** 2026-03-23  
**Status:** ATIVO — Nenhuma alteração pode violar estas regras.

---

## Regras Absolutas

### 1. NUNCA alterar arquivos protegidos
Estes arquivos são auto-gerados e NÃO podem ser editados manualmente:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`

### 2. NUNCA remover rotas existentes
Todas as rotas listadas em `src/test/stability-routes.test.ts` são protegidas.
Novos módulos devem ADICIONAR rotas, nunca remover ou renomear existentes.

### 3. NUNCA alterar componentes core sem testes
Componentes blindados (qualquer alteração exige revisão):
- `Header.tsx`, `Footer.tsx`
- `DashboardLayout.tsx`, `AdminLayout.tsx`
- `ProtectedRoute.tsx`
- `SponsorImage.tsx`, `AdBanner.tsx`, `AdShowcase.tsx`, `SponsorsSection.tsx`
- `SponsorAd.tsx`

### 4. NUNCA alterar hooks de autenticação
- `useAuth.tsx` — contexto de auth global
- `useAdmin.tsx` — verificação de role admin
- Fluxo de login/cadastro/reset-password

### 5. NUNCA alterar lógica de RLS existente
Políticas RLS existentes são consideradas estáveis.
Novos módulos devem criar NOVAS políticas, não modificar existentes.

### 6. Imagens de patrocinadores — REGRA DE OURO
- `object-fit: contain` SEMPRE (nunca `cover`)
- `object-position: center` SEMPRE
- ZERO overflow-hidden em containers de sponsor
- Imagens devem aparecer 100% completas em qualquer dispositivo

---

## Regras para Novos Módulos (CRM/CMS)

### Isolamento
- Todo novo módulo deve ser envolvido em `<ModuleBoundary>` 
- Falhas em módulos novos NÃO podem afetar a plataforma principal
- Novas páginas devem usar rotas com prefixo dedicado (ex: `/sponsor-panel/`)

### Banco de Dados
- Novas tabelas devem ter prefixo consistente (ex: `sponsor_contacts`, `sponsor_campaigns`)
- NUNCA alterar schema de tabelas existentes
- RLS obrigatório em todas as novas tabelas

### Testes
- Rodar `npm test` antes de qualquer merge
- Testes em `stability-core.test.ts` e `stability-routes.test.ts` devem passar 100%

---

## Tabelas Blindadas (não alterar schema)
- `profiles`, `providers`, `services`, `reviews`, `leads`
- `categories`, `cities`, `neighborhoods`
- `sponsors`, `subscriptions`, `user_roles`
- `jobs`, `blog_posts`, `faqs`, `highlights`
- `community_links`, `popular_services`, `site_settings`
- `service_categories`, `service_images`
- `provider_page_settings`

## Funções DB Blindadas (não alterar)
- `has_role()`, `handle_new_user()`, `auto_approve_provider()`
- `auto_premium_provider()`, `auto_migrate_profile_type()`
- `sanitize_provider_slug()`, `sanitize_provider_phone()`
- `increment_sponsor_click()`, `increment_sponsor_impression()`
