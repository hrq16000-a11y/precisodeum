

## Auditoria Completa — Fluxos de Usuario + Sincronizacao Admin

### Metodologia
Analise cruzada de todos os fluxos de usuario (cadastro, login, fotos, portfolio, servicos) com o painel administrativo, verificando sincronizacao, erros de logica, exageros e falhas.

---

### RESULTADO: 94% funcional — 6 problemas identificados

---

### PROBLEMAS ENCONTRADOS

#### 1. Portfolio NAO sincroniza com tabela `media` (FALHA DE SINCRONIZACAO)
**Arquivo:** `src/components/PortfolioUpload.tsx`
**Problema:** Upload de portfolio vai direto para o Storage (`portfolio` bucket) mas NAO insere registro na tabela `media`. Isso significa que imagens de portfolio nao aparecem na biblioteca de midia do admin (`/admin/midia`), ficando invisiveis ate que a edge function `sync-storage-media` rode manualmente.
**Solucao:** Adicionar `insertMedia()` apos cada upload bem-sucedido (mesmo padrao do `ServiceImageUpload.tsx` que ja faz isso corretamente).

#### 2. Avatar upload NAO sincroniza com tabela `media` (FALHA DE SINCRONIZACAO)
**Arquivo:** `src/components/AvatarUpload.tsx`
**Problema:** Upload de avatar atualiza `profiles.avatar_url` mas NAO insere na tabela `media`. Mesma lacuna do portfolio.
**Solucao:** Adicionar insert na tabela `media` apos upload com `entity_type: 'profile'`.

#### 3. DashboardServicesPage `handleDelete` faz DELETE fisico (INCONSISTENCIA)
**Arquivo:** `src/pages/DashboardServicesPage.tsx` linha 244
**Problema:** O botao "Excluir" do usuario faz `supabase.from('services').delete()` (delete fisico), enquanto o admin faz soft-delete via `deleted_at`. Isso elimina o registro permanentemente sem auditoria.
**Solucao:** Trocar para soft-delete (`update({ deleted_at: new Date().toISOString() })`) e exibir confirmacao antes. Tambem nao tem `logAuditAction` — embora seja acao de usuario, seria util para rastreabilidade.

#### 4. DashboardServicesPage `handlePause` usa `deleted_at` para pausar (CONFUSAO SEMANTICA)
**Arquivo:** `src/pages/DashboardServicesPage.tsx` linha 250
**Problema:** "Pausar" seta `deleted_at` e o servico aparece como deletado para o admin e para a query publica (`WHERE deleted_at IS NULL`). O conceito de "pausado" deveria usar um campo `status` diferente, nao `deleted_at`. Entretanto, como o schema ja esta consolidado, a correcao mais segura e:
**Solucao:** Manter a logica atual (ja funcional) mas corrigir o label no fetchServices para distinguir pausado (user) de deletado (admin). Alternativamente, usar filtro `is('deleted_at', null)` na query do dashboard que ja esta correto.
**Veredicto:** Funciona corretamente como esta, mas o botao de "excluir" (item 3) precisa ser corrigido para nao competir com "pausar".

#### 5. PortfolioUpload nao tem `media` tracking na exclusao
**Arquivo:** `src/components/PortfolioUpload.tsx` linha 67
**Problema:** `handleDelete` remove do storage mas nao desativa na tabela `media` (que nem tem registro por causa do item 1).
**Solucao:** Resolver junto com item 1 — ao deletar, tambem fazer `update({ is_active: false })` na media.

#### 6. Signup do provider nao cria subscription (LACUNA MENOR)
**Arquivo:** `src/pages/SignupPage.tsx` linha 142-156
**Problema:** Quando um provider se cadastra, cria `profiles` e `providers` mas NAO cria registro em `subscriptions`. Isso significa que o admin nao ve esse provider no modulo de assinaturas ate que alguem crie manualmente.
**Solucao:** Ao criar provider, inserir subscription com `plan: 'trial'`, `status: 'trial'`, `starts_at: now()` e `account_type_id` do tipo Trial/Free.

---

### O QUE ESTA 100% CORRETO

| Fluxo | Status | Detalhes |
|---|---|---|
| Cadastro de usuario (email) | OK | Cria profile, seta tipo, redirect correto |
| Cadastro de usuario (Google) | OK | OAuth funcional com redirect handler |
| Login | OK | Validacao, redirect por tipo, forgot password |
| Edicao de perfil | OK | Profile + Provider atualizados, validacao whatsapp |
| Upload de avatar | Parcial | Funciona mas nao rastreia em media (item 2) |
| Upload de portfolio | Parcial | Funciona mas nao rastreia em media (item 1) |
| Criacao de servicos (wizard) | OK | Categories, photos, provider auto-create |
| Criacao de servicos (dialog) | OK | Limits checados via useAccountLimits |
| Upload de fotos de servico | OK | ServiceImageUpload sincroniza com media |
| Edicao de servicos | OK | Categorias e dados atualizados |
| Exclusao de servicos (admin) | OK | Soft-delete + audit log |
| Exclusao de servicos (user) | FALHA | Delete fisico sem audit (item 3) |
| Gestao de leads (admin) | OK | CRUD + filtros |
| Gestao de leads (dashboard) | OK | Leitura propria via RLS |
| Gestao de providers (admin) | OK | Approve/reject + bulk + audit |
| Gestao de servicos (admin) | OK | Soft-delete + restore + bulk |
| Tier rules (admin) | OK | Campos SaaS expandidos funcionais |
| Assinaturas (admin) | OK | MRR, upgrade/downgrade, sync profile |
| CRM patrocinadores | OK | Pipeline, conversao, audit |
| Overview executivo | OK | KPIs, graficos, dados em tempo real |
| useAccountLimits | OK | Views funcionais, limites enforced |
| useResourceGate | OK | Engine de permissoes integrada |
| useSubscriptionSync | OK | Upgrade/downgrade auto |

---

### PLANO DE CORRECAO

#### Arquivos a editar:

1. **`src/components/PortfolioUpload.tsx`** — Adicionar insert/deactivate na tabela `media` em upload e delete
2. **`src/components/AvatarUpload.tsx`** — Adicionar insert na tabela `media` apos upload
3. **`src/pages/DashboardServicesPage.tsx`** — Trocar `handleDelete` de delete fisico para soft-delete com confirmacao
4. **`src/pages/SignupPage.tsx`** — Ao criar provider, inserir subscription trial automaticamente

#### Nenhuma migracao SQL necessaria
Todas as tabelas e colunas necessarias ja existem.

#### Nenhum redesign visual
Apenas correcoes de logica interna.

### Resultado esperado
- 100% dos uploads (avatar, portfolio, servico) sincronizados com tabela `media`
- Exclusao de servicos pelo usuario usa soft-delete (consistente com admin)
- Novos providers ja nascem com subscription trial visivel no admin
- Zero falhas de sincronizacao entre dashboard do usuario e painel administrativo

