# Auditoria 360º Completa — v2
**Data:** 2026-04-18 · **Modo:** Auditor Passivo (somente leitura) · **Nenhuma alteração aplicada**

---

## Sumário Executivo

| Quadrante | Status | Severidade |
|---|---|---|
| 1. Banco & Sincronização | 🟢 Íntegro | Baixa |
| 2. Mídias / Storage / RLS | 🔴 **Quebrado** | **Crítica** |
| 3. Buracos negros de CRUD | 🟡 7 lacunas | Média-Alta |
| 4. Jornada do Profissional | 🟡 Fricção pontual | Média |

**Veredito:** O banco está **saudável** (0 órfãos, 0 `user_ref` nulos). A quebra de mídia **não é de upload** — é o **estado pré-existente dos `avatar_url`** que aponta para domínios externos quebrados. Há 7 tabelas vivas sem tela de gestão.

---

## 1. Integridade de Banco e Sincronização

### 1.1 Propagação `user_ref` × `user_id` — ✅ 100% íntegro

| Tabela | Total | `user_ref` NULL | Status |
|---|---:|---:|---|
| profiles | 252 | 0 | ✅ |
| providers | 188 | 0 | ✅ |
| services | 162 | 0 | ✅ |
| portfolio_albums | 61 | 0 | ✅ |
| portfolio_photos | 1729 | 0 | ✅ |
| media | 2741 | 0 | ✅ |

### 1.2 Órfãos relacionais — ✅ Zero

- `orphan_media`: **0** (todo `user_ref` resolve em `profiles`)
- `orphan_albums`: **0**
- `orphan_photos`: **0**
- `providers_no_user`: **0**

### 1.3 Triggers ativos — 77 triggers em 31 tabelas

Todos os triggers críticos estão presentes e operando:

- ✅ `trg_set_user_ref*` em profiles, providers, services, leads, media, portfolio_*, jobs, notifications, reviews, user_tags, pps
- ✅ `trg_prevent_user_ref_update*` (imutabilidade garantida em 7 tabelas)
- ✅ `trg_sync_*` (counters: city_provider_count, services_count, photo_count, album_count, portfolio_count_media)
- ✅ `trg_gamify_*` (5 triggers de pontos: lead, photo, profile_complete, profile_photo, review, service_created)
- ✅ `trg_auto_level_on_points_change` + `trg_autoheal_profile_level_id` (correção do bug FK do `level_id` antigo)
- ✅ `trg_detect_signup_abuse` (anti-fraude IP)
- ✅ `trg_sync_provider_geog` (PostGIS sincronizado)
- ✅ `trg_sanitize_provider_phone` + `trg_sanitize_provider_slug`

### 1.4 SEO dinâmico

⚠️ **Não existe trigger de geração de SEO no banco.** O SEO é montado em **runtime** pelo hook `useSeoHead` em `ProviderProfile.tsx`, `ServiceDetailPage.tsx`, `BlogPostPage.tsx` etc. Não há campos `seo_title`/`seo_description` persistidos em `providers` ou `services` (só existe `meta_title`/`meta_description` em `providers`, hoje preenchidos manualmente).

**Decisão pendente:** persistir SEO no banco (via trigger) ou manter runtime-only? Hoje está **runtime-only** e funcional.

---

## 2. Mídias, Storage e RLS — 🔴 Onde está o gargalo

### 2.1 Buckets (todos públicos ✅)

| Bucket | Public |
|---|---|
| avatars | ✅ |
| portfolio | ✅ |
| service-images | ✅ |
| sponsors | ✅ |

### 2.2 Políticas RLS de `storage.objects` — ✅ 20 policies corretas

- ✅ `Public read individual files` cobre os 4 buckets
- ✅ INSERT/UPDATE/DELETE escopados por `auth.uid()` em cada bucket
- ✅ Admin override em todos os 4 buckets

**Conclusão RLS:** RLS **NÃO** está bloqueando nada. Buckets públicos + leitura anônima liberada.

### 2.3 🔴 RAIZ DA "QUEBRA DE MÍDIA" — descoberta crítica

A tabela `media` está 100% íntegra (2.741 registros, todos com `public_url`). **O problema está em `profiles.avatar_url` e `providers.photo_url`:**

| Métrica | Valor | Diagnóstico |
|---|---:|---|
| Avatares apontando para `ui-avatars.com` (placeholder externo) | **92** | URLs do tipo `https://ui-avatars.com/api/...` — serviço externo, frequentemente lento/instável |
| Profiles com `avatar_url` populado | 233 / 252 | OK em quantidade |
| Providers com `photo_url` populado | 105 / 188 | 83 sem foto (44%) |
| `media.public_url` válido | 2741 / 2741 | ✅ Storage íntegro |

**Conclusão:** O upload e o bucket **funcionam**. O que o usuário vê como "quebrado" são os 92 avatares legados gerados via `ui-avatars.com` (geração de iniciais), que dependem de DNS externo. Nenhum upload novo é feito para esse domínio — é dado **pré-existente da migração**.

### 2.4 Componentes de exibição inspecionados

- `AvatarUpload.tsx` — ✅ usa Supabase Storage corretamente
- `ImageUploadField.tsx` — ✅ correto
- Edge Function `optimize-image` — ✅ sem erros nos logs

---

## 3. Buracos Negros na Gestão (CRUD ausente)

Cruzei **81 tabelas públicas** vs **49 páginas Admin**. Tabelas com dados/uso real **sem tela de gestão**:

| Tabela | Linhas | Impacto | Prioridade |
|---|---:|---|---|
| `gamification_levels` | 7 | 🔴 Não há CRUD para criar/editar níveis nem listar usuários por nível. `AdminGamificationPage` só edita `score_rules`. | **CRÍTICA** |
| `score_rules` | 13 | 🟡 Editável só via SQL. Existe parcialmente em AdminGamification mas sem UX claro. | Alta |
| `tier_rules` | 5 | 🟡 Sem UI. Define cota de leads por tier — config crítica. | Alta |
| `user_levels` | 5 | 🟠 **Tabela duplicada/legacy** vs `gamification_levels`. Provavelmente deve ser removida. | Investigar |
| `service_categories` | 312 | 🟠 Coexiste com `categories` (taxonomia hierárquica) — provável legacy. | Investigar |
| `runtime_fallback_registry` | 0 | 🟢 Vazia, sem tela. Engine de auto-cura sem painel. | Baixa |
| `runtime_component_health` | 0 | 🟢 Vazia, sem painel histórico. | Baixa |
| `system_contract_map` | 0 | 🟢 Vazia. | Baixa |
| `system_drift_reports` | 0 | 🟢 Vazia. | Baixa |
| `sponsor_regions` | 0 | 🟡 Vazia mas usada por sponsor_plans. Sem CRUD. | Média |
| `subscriptions` | 3 | 🟡 Sem painel admin. | Média |
| `neighborhoods` | 0 | 🟢 Vazia. | Baixa |

### 3.1 Foco crítico: `gamification_levels`

- **252 usuários** todos no nível "Iniciante" (0 pts) — **distribuição 100% concentrada** confirma que ninguém ganhou pontos efetivos ou que a recálculo nunca rodou em massa em produção.
- Não existe `/admin/niveis` ou similar para: criar/editar nome/cores/min_points/benefícios; listar usuários por nível; promover manualmente; rodar `admin_recalculate_all_engagement()` via UI.

### 3.2 Páginas Admin órfãs (existem mas sem tabela viva)

- `AdminBoostsPage` — sem tabela `boosts`
- `AdminBlocksPage` — verificar se realmente lista `ip_blocks`
- `AdminCommunityPage` — usa `community_links` (4 linhas), OK

---

## 4. Jornada do Profissional — Quebras silenciosas

Simulação: Signup → criar perfil → criar serviço → adicionar portfólio.

| Etapa | Status | Observação |
|---|---|---|
| Signup (`/cadastro`) | ✅ | Captcha + anti-abuso IP funcionando |
| `handle_new_user` (auto-cria profile) | ✅ | `trg_set_user_ref` + `trg_autoheal_profile_level_id` |
| Auto-detect IP suspeito | ✅ | Trigger detect_signup_abuse ativo |
| Onboarding tour | ✅ | Persistido em `onboarding_completed` |
| Criar provider | ✅ | `auto_approve_provider_trigger` ativa se cidade preenchida |
| Criar serviço | ✅ | `trg_auto_migrate_on_service_insert` promove `client→provider` |
| Upload avatar | ⚠️ | Funciona, mas `AvatarReminder` insiste mesmo após upload em alguns casos (verificar dependência reativa) |
| Upload portfólio | ✅ | Triggers de count e gamificação OK |
| Pontuação | ⚠️ | Gatilho dispara mas **0 usuários acima de 100 pts** sugere que `award_engagement_points` não está sendo chamado em produção, OU recálculo histórico nunca rodou |
| Recálculo manual | ❌ | Função `admin_recalculate_all_engagement()` existe no banco mas **não há botão na UI** |

### 4.1 Inconsistências de UX

1. **`gamification_levels` com 252 usuários no Iniciante** — alguém precisa rodar `admin_recalculate_all_engagement()` (existe no DB, não exposto na UI).
2. **92 avatares quebrados via `ui-avatars.com`** — solução: gerar fallback local (iniciais via SVG/Canvas) e migrar via script.
3. **Sem CRUD de Níveis** — Admin não consegue ajustar regras de gamificação visualmente.

---

## Plano de Ação Cirúrgico (próxima sessão — aguardar aprovação)

### 🔴 P0 — Crítico (≤30 min)

1. **CRUD de `gamification_levels`** em `/admin/niveis`:
   - Listar 7 níveis com badges visuais
   - Editar `name`, `min_points`, `color`, `icon`, `benefits` (jsonb)
   - Botão "Recalcular pontos de todos" → chama `admin_recalculate_all_engagement()`
   - Tab "Distribuição" usando `admin_get_level_distribution()` (já existe)
   - Drilldown: clicar em um nível → lista de usuários nele

2. **Sanear avatares quebrados (92 registros)**:
   - Migration que limpa `profiles.avatar_url` quando `LIKE 'https://ui-avatars.com%'` → `NULL`
   - Frontend: garantir fallback local (`<Avatar>` com `<AvatarFallback>` exibindo iniciais via CSS, sem requisição externa)

### 🟠 P1 — Alta (≤45 min)

3. **CRUD de `score_rules`** dentro de `/admin/gamificacao` (tab dedicada):
   - Editar `points`, `max_per_day`, `cooldown_hours`, `active`
4. **CRUD de `tier_rules`** (cotas de leads por tier):
   - Editar `lead_quota`, `features` (jsonb)
5. **Investigar e resolver duplicatas legacy**:
   - `user_levels` vs `gamification_levels` — confirmar deprecação e remover referências
   - `service_categories` vs `categories` — definir fonte canônica

### 🟡 P2 — Média (≤30 min)

6. **CRUD de `subscriptions`** (3 linhas existentes) — listar e editar status
7. **CRUD de `sponsor_regions`** dentro de `/admin/patrocinadores`
8. **Painel Runtime Health** consolidado em `/admin/saude` mostrando `runtime_component_health` + `system_drift_reports`

### 🟢 P3 — Polimento

9. **Persistir SEO** (decisão a discutir): trigger que preenche `meta_title`/`meta_description` em `providers` e equivalente em `services` quando vazios
10. **Botão "Forçar recálculo"** acessível em qualquer perfil de usuário do Admin

---

## Arquivos auditados (somente leitura)

- `supabase/functions/optimize-image/index.ts`
- `src/components/AvatarUpload.tsx`, `ImageUploadField.tsx`, `ServiceImageUpload.tsx`
- `src/pages/Admin*.tsx` (49 arquivos)
- 77 triggers, 81 tabelas, 20 policies de storage

**Nenhum arquivo foi modificado.** Aguardando aprovação para executar o Plano de Ação na próxima sessão.
