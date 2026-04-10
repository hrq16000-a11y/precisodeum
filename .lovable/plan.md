

# Auditoria Profunda — Plataforma Preciso de Um

## Resumo Executivo

A plataforma foi auditada em 5 dimensões: **Segurança**, **Estabilidade Runtime**, **Banco de Dados**, **Código** e **Governança**. Foram encontrados **14 problemas** sendo **5 críticos**, **6 médios** e **3 baixos**.

---

## 1. SEGURANÇA — Problemas Críticos

### 1.1 CRÍTICO — Storage "sponsors" sem verificação de role admin
As políticas `Admin insert sponsors`, `Admin update sponsors` e `Admin delete sponsors` verificam apenas `bucket_id = 'sponsors'` — qualquer usuário autenticado pode sobrescrever ou excluir imagens de patrocinadores.

**Correção:** Adicionar `has_role(auth.uid(), 'admin'::app_role)` nas condições USING/WITH CHECK dessas 3 políticas.

### 1.2 CRÍTICO — 7 Views SECURITY DEFINER no schema public
As views `public_profiles`, `account_model_view`, `account_limits_view`, `user_master_view`, `export_users`, `city_provider_stats` e `public_jobs` estão com `security_invoker=false` (padrão SECURITY DEFINER), bypassando RLS das tabelas subjacentes.

**Correção:** Migração SQL para definir `ALTER VIEW ... SET (security_invoker = true)` em todas as 7 views.

### 1.3 MÉDIO — audit_log INSERT restrito a admins
A política `Admins can insert audit log` exige `has_role(auth.uid(), 'admin')`, mas o código (`useAuditLog.ts`) tenta inserir para qualquer usuário autenticado. Ações de usuários normais (leads, uploads) falham silenciosamente.

**Correção:** Alterar a política INSERT para `auth.uid() = user_id` (permitir qualquer autenticado inserir seu próprio log) ou criar uma função SECURITY DEFINER para inserções.

### 1.4 MÉDIO — user_levels expõe permissions JSONB publicamente
A policy `User levels viewable by everyone` com `USING (true)` expõe toda a estrutura de permissões internas incluindo `create_users`, `delete_users`, `manage_billing`.

**Correção:** Criar uma view pública limitada (nome, cor, descrição) e restringir o SELECT da tabela a autenticados.

### 1.5 BAIXO — Leaked Password Protection desativado
Proteção contra senhas vazadas está desabilitada.

**Correção:** Ativar via configuração de autenticação.

---

## 2. ESTABILIDADE RUNTIME — Problemas Ativos

### 2.1 CRÍTICO — Dynamic imports falhando (tela branca)
Três componentes com falha de importação dinâmica causando **blank screen**:
- `AdSlot` em `Index.tsx` (linha 43) — usa `lazy(() => import(...))` SEM `importWithRetry`
- `Footer` em `Index.tsx` (linha 48) — SEM `importWithRetry`  
- `FeaturedProviders` em `Index.tsx` (linha 26) — SEM `importWithRetry`
- `SponsorFooterCTA` em `Index.tsx` (linha 45) — SEM `importWithRetry`
- Outros em `Index02.tsx`, `CityDetailPage.tsx`, `CityPage.tsx`, `CategoryPage.tsx` (SponsorFooterCTA)

Esses componentes já foram corrigidos em `Header.tsx`, `Footer.tsx`, `JobsPage.tsx`, `ProviderProfile.tsx` mas **Index.tsx permanece vulnerável**.

**Correção:** Substituir TODOS os `lazy(() => import(...))` por `lazy(() => importWithRetry(() => import(...)))` em `Index.tsx`, `Index02.tsx`, `CityDetailPage.tsx`, `CityPage.tsx`, `CategoryPage.tsx`.

### 2.2 MÉDIO — LazyErrorBoundary silenciosa
O `LazyErrorBoundary` em Index.tsx renderiza `null` quando falha — o usuário vê seções desaparecendo sem feedback.

**Correção:** Adicionar feedback visual mínimo (skeleton ou mensagem de retry).

---

## 3. BANCO DE DADOS

### 3.1 MÉDIO — Duplicação de políticas de storage
Existem políticas duplicadas para avatars (`Authenticated users can upload avatars` E `Authenticated users can upload own avatars`) e portfolio (`Authenticated users can upload portfolio` E `Authenticated users can upload own portfolio`). Não causam bug mas poluem a governança.

**Correção:** Remover as políticas duplicadas.

### 3.2 MÉDIO — RLS "always true" em INSERT/UPDATE
2 políticas detectadas com `WITH CHECK (true)` ou `USING (true)` para operações de escrita. Não foi possível identificar as tabelas exatas pelo scan, mas são potencialmente perigosas.

**Correção:** Investigar e restringir a `auth.uid()` scoped.

---

## 4. CÓDIGO

### 4.1 BAIXO — Uso de `as any` em queries Supabase
`useAuditLog.ts` e `LeadEditDialog.tsx` usam `as any` para contornar tipagem — indica tabelas ou colunas não refletidas no types.ts gerado.

### 4.2 BAIXO — Index.tsx com 300+ linhas
O componente principal da home tem complexidade alta. Idealmente deveria delegar para um componente orquestrador de seções.

---

## 5. PLANO DE EXECUÇÃO

### Fase 1 — Correções Críticas (imediato)
1. **Fix dynamic imports** — Aplicar `importWithRetry` em TODOS os lazy imports de `Index.tsx`, `Index02.tsx`, `CityDetailPage.tsx`, `CityPage.tsx`, `CategoryPage.tsx`
2. **Fix storage sponsors policies** — Migração SQL adicionando `has_role(auth.uid(), 'admin')` 
3. **Fix views SECURITY DEFINER** — Migração SQL com `ALTER VIEW ... SET (security_invoker = true)` nas 7 views

### Fase 2 — Segurança média
4. **Fix audit_log INSERT policy** — Permitir qualquer autenticado inserir seu próprio log
5. **Fix user_levels exposure** — Criar view pública limitada
6. **Remover storage policies duplicadas**

### Fase 3 — Qualidade
7. **Melhorar LazyErrorBoundary** com feedback visual
8. **Ativar leaked password protection**

### Arquivos modificados
- `src/pages/Index.tsx` — importWithRetry em todos lazy imports
- `src/pages/Index02.tsx` — importWithRetry
- `src/pages/CityDetailPage.tsx` — importWithRetry
- `src/pages/CityPage.tsx` — importWithRetry  
- `src/pages/CategoryPage.tsx` — importWithRetry (SponsorFooterCTA)
- 1 migração SQL para storage policies + views + audit_log + user_levels

### O que NÃO será alterado
- GeoEngine, SIL, searchIntelligence (imutáveis)
- Tabelas blindadas (conforme manifesto)
- Funções DB blindadas
- `client.ts`, `types.ts`, `.env`

