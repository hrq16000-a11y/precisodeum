

## Plano: Evolução SaaS Multi-Camadas — Sistema Operacional Completo

### Diagnóstico do Estado Atual

O sistema ja possui:
- **Tabelas core**: `profiles`, `providers`, `account_types`, `user_levels`, `user_roles`, `tier_rules`, `plan_resources`, `subscriptions`, `user_tags`
- **Views**: `account_model_view`, `account_limits_view`, `user_master_view`
- **Hook de limites**: `useAccountLimits` (funcional, lê tier e verifica limites)
- **Admin existente**: 5 abas em `/admin/tipos-conta` (Profile Types, Account Types, Levels, Tier Rules, Plan Resources)
- **Assinaturas**: Pagina funcional com MRR, mas desconectada de account_types
- **Audit**: Funcional mas com tipos de evento limitados
- **Lacuna principal**: Nenhum dashboard executivo unificado; subscriptions nao vinculam a account_type; nao existe upgrade/downgrade automatico; tier_rules tem poucos campos

### Implementacoes (6 blocos)

---

#### 1. Expandir `tier_rules` com campos de controle SaaS
**Migracao SQL** — adicionar colunas a `tier_rules`:
- `max_ads` (integer, default 0)
- `max_slots` (integer, default 0)
- `can_access_crm` (boolean, default false)
- `can_access_reports` (boolean, default false)
- `can_access_featured` (boolean, default false)
- `ranking_priority` (integer, default 0)
- `search_boost` (integer, default 0)

Atualizar `account_limits_view` para expor os novos campos.

Atualizar `AdminTierRulesPage.tsx` para exibir e editar os novos campos no formulario existente.

---

#### 2. Vincular `subscriptions` a `account_type_id`
**Migracao SQL** — adicionar coluna:
- `account_type_id` (uuid, nullable, references account_types)

Atualizar `AdminSubscriptionsPage.tsx`:
- Mostrar nome do plano (account_type) vinculado
- Ao renovar/criar, selecionar account_type
- Historico de mudancas de plano (registrado via audit_log)
- Adicionar campos de LTV basico e churn rate nos KPIs

---

#### 3. Hook `useResourceGate` — Engine de permissoes por plano
Criar `src/hooks/useResourceGate.ts`:
- Centraliza verificacao: dado um recurso (ex: `can_access_crm`, `max_services`), consulta `useAccountLimits` + `usePermissions` e retorna `{ allowed: boolean, reason?: string }`
- Usado em qualquer componente para bloquear acoes baseado no plano/nivel
- Integra com `tier_rules` expandido

---

#### 4. Dashboard Executivo `/admin/overview`
Criar `src/pages/AdminOverviewPage.tsx`:
- **Usuarios por tipo** (client/provider/rh) — PieChart
- **MRR** — puxado de subscriptions ativas x account_types.price
- **Conversao de leads** — leads novos vs convertidos (30 dias)
- **Uso de recursos** — servicos criados vs limite por plano
- **Ocupacao de slots** — ad_slot_assignments ativos vs ad_slots.max_ads
- **Performance patrocinadores** — top 5 por CTR
- **Churn rate** — subscriptions canceladas / total (30 dias)
- Cards KPI no topo, graficos Recharts abaixo
- Rota: `/admin/overview`, adicionada ao AdminGroupNav no grupo "Geral"

---

#### 5. Automacao de upgrade/downgrade
Criar `src/hooks/useSubscriptionSync.ts`:
- Quando admin altera subscription (plano/status), automaticamente:
  - Atualiza `profiles.account_type_id` para o novo account_type
  - Se cancelado/expirado: rebaixa para account_type "Trial/Free"
  - Registra audit_log com `plan_upgraded` ou `plan_downgraded`
- Integrado no `AdminSubscriptionsPage` via mutation

Atualizar `AdminSubscriptionsPage.tsx`:
- Dialog de upgrade/downgrade com selecao de account_type
- Ao mudar status para canceled: auto-rebaixa

---

#### 6. Auditoria expandida + integracao entre modulos
Expandir `logAuditAction` com tipos padronizados:
- `user_updated`, `role_changed`, `plan_upgraded`, `plan_downgraded`, `resource_used`, `lead_converted`, `subscription_changed`, `slot_updated`

Garantir que todas as paginas admin existentes usem os tipos corretos (revisao pontual nos arquivos que ja chamam `logAuditAction`).

---

### Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| `src/pages/AdminOverviewPage.tsx` | Criar — Dashboard executivo |
| `src/hooks/useResourceGate.ts` | Criar — Engine de permissoes |
| `src/hooks/useSubscriptionSync.ts` | Criar — Logica upgrade/downgrade |
| `src/pages/AdminTierRulesPage.tsx` | Editar — Novos campos SaaS |
| `src/pages/AdminSubscriptionsPage.tsx` | Editar — Vincular account_type, LTV, churn, upgrade/downgrade |
| `src/hooks/useAuditLog.ts` | Editar — Novos tipos de evento |
| `src/components/admin/AdminGroupNav.tsx` | Editar — Adicionar Overview |
| `src/App.tsx` | Editar — Rota /admin/overview |

### Migracoes SQL

1. `ALTER TABLE tier_rules ADD COLUMN max_ads integer NOT NULL DEFAULT 0, ADD COLUMN max_slots integer NOT NULL DEFAULT 0, ADD COLUMN can_access_crm boolean NOT NULL DEFAULT false, ADD COLUMN can_access_reports boolean NOT NULL DEFAULT false, ADD COLUMN can_access_featured boolean NOT NULL DEFAULT false, ADD COLUMN ranking_priority integer NOT NULL DEFAULT 0, ADD COLUMN search_boost integer NOT NULL DEFAULT 0;`

2. `ALTER TABLE subscriptions ADD COLUMN account_type_id uuid REFERENCES account_types(id);`

3. Atualizar `account_limits_view` para incluir novos campos de `tier_rules`.

### O que NAO sera alterado
- Schemas existentes (apenas extensao com novas colunas)
- Padrao de componentes (AdminLayout, useAdmin, useQuery)
- UI existente (sem redesign)
- Tabelas consolidadas (profiles, providers, etc.)
- RLS policies existentes (novas colunas herdam policies da tabela)

### Resultado esperado
- Todo usuario tem tipo + nivel + role + plano vinculados
- Recursos controlados por regra dinamica (tier_rules expandido)
- Upgrade/downgrade altera permissoes automaticamente
- Dashboard executivo com MRR, churn, conversao, ocupacao
- Auditoria cobre todas as acoes criticas com tipos padronizados
- Zero dependencia de banco manual para operacoes

