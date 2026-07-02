# Relatório de Governança do Sistema — Base de Conhecimento

> Atualizado: 2026-04-12

---

## 1. Arquitetura de Controle (4 Camadas)

```
┌─────────────────────────────────────────────────┐
│  CAMADA 1: user_roles (RBAC)                    │
│  → Controla ACESSO ao painel admin              │
│  → has_role(uid, 'admin')                       │
├─────────────────────────────────────────────────┤
│  CAMADA 2: user_levels (Permissões granulares)  │
│  → Controla O QUE pode fazer dentro do admin    │
│  → JSONB de permissions por nível               │
├─────────────────────────────────────────────────┤
│  CAMADA 3: tier_rules + account_types.tier_key  │
│  → Controla LIMITES operacionais                │
│  → max_services, max_leads, can_create/receive  │
│  → SINCRONIZADO via trigger trg_sync_provider   │
├─────────────────────────────────────────────────┤
│  CAMADA 4: account_types (Planos comerciais)    │
│  → Rótulo comercial + tier_key vinculado        │
│  → Mudança propaga para providers.plan via DB   │
└─────────────────────────────────────────────────┘
```

## 2. Tipos de Cadastro (profile_type_settings)

| Tipo | profile_key | role | tier_key | Cor |
|------|------------|------|----------|-----|
| Cliente | `client` | `client` | `free_client` | #3b82f6 |
| Profissional | `provider` | `provider` | `free_provider` | #10b981 |
| Agência/RH | `rh` | `client` | `free_rh` | #8b5cf6 |

## 3. Planos Comerciais (account_types) → Tier Mapping

| Plano | Preço | tier_key | Efeito no provider |
|-------|-------|----------|--------------------|
| Trial | R$ 0 | `free` | plan=free, featured=false |
| Basic | R$ 29,90 | `free` | plan=free, featured=false |
| Premium | R$ 299,90 | `premium` | plan=premium, featured=true |
| Enterprise | R$ 999,90 | `premium` | plan=premium, featured=true |
| Agência RH | R$ 89,90 | `free` | plan=free, featured=false |

**Sincronização**: O trigger `trg_sync_provider_plan` na tabela `profiles` detecta mudanças no `account_type_id` e atualiza automaticamente `providers.plan` e `providers.featured` com base no `tier_key` do plano.

## 4. Regras Operacionais (tier_rules)

| Tier | can_create_services | max_services | can_receive_leads | max_leads |
|------|:---:|:---:|:---:|:---:|
| free_client | ❌ | 0 | ❌ | 5 |
| free_provider | ✅ | 3 | ❌ | 20 |
| free_rh | ❌ | 0 | ❌ | 5 |
| premium | ✅ | ∞ (-1) | ✅ | ∞ (-1) |
| other | ❌ | 0 | ❌ | 0 |

## 5. Hierarquia de Níveis (user_levels)

| Nível | Prioridade | Permissões-chave |
|-------|:---------:|------------------|
| Administrador | 100 | Tudo |
| Gerente | 80 | Criar, Editar, Ver Usuários, Relatórios |
| Supervisor | 60 | Editar, Ver Usuários, Relatórios |
| Analista | 40 | Ver Usuários, Relatórios |
| Usuário | 10 | Nenhuma permissão admin |

## 6. Fluxo de Atribuição no Cadastro

1. Trigger `handle_new_user()`: cria profile com level=Usuário, account_type=Trial
2. Trigger `auto_premium_provider()`: se providers ≤ 500 ou data ≤ 30/06/2027 → plan=premium
3. View `account_model_view`: determina `account_tier` baseado em providers.plan + account_types.tier_key
4. View `account_limits_view`: cruza tier com tier_rules para limites

## 7. Recursos Funcionais vs Placeholders

### ✅ Funcionais
- Página profissional, Portfólio, Serviços, Leads, Busca, Vagas, Chat

### ⚠️ Parciais
- Estatísticas de perfil, Personalização visual

### ❌ Placeholders (sem lógica)
- API Access, SSO, Custom Integrations, Priority Support, Storage labels

## 8. CRM — Lacunas para 100%

1. Pipeline de vendas automatizado (follow-up)
2. Lead scoring
3. Automação de upsell
4. Relatórios exportáveis (CSV/PDF)
5. Lifecycle emails
