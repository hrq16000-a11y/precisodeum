

# Relatório Técnico e Funcional — Governança do Sistema

---

## 1. Mapeamento de Tipos de Conta e Regras

### 1.1 Tipos de Cadastro (profile_type_settings)

O sistema possui **3 tipos de cadastro** configurados na tabela `profile_type_settings`:

| Tipo | profile_key | role | tier_key | Cor |
|------|------------|------|----------|-----|
| Cliente | `client` | `client` | `free_client` | Azul #3b82f6 |
| Profissional | `provider` | `provider` | `free_provider` | Verde #10b981 |
| Agência/RH | `rh` | `client` | `free_rh` | Roxo #8b5cf6 |

**Importante**: Agência/RH usa `role: client` por segurança — não herda permissões de `provider` no banco.

### 1.2 Capabilities por Tipo

**Cliente**: Buscar profissionais ✅ | Solicitar orçamentos ✅ | Ver perfis ✅ | Avaliar ✅ | Cadastrar serviços ❌ | Receber leads ❌ | Publicar vagas ❌ | Página profissional ❌

**Profissional**: Página profissional ✅ | Cadastrar serviços ✅ | Receber leads ✅ | Publicar vagas ✅ | Portfólio ✅ | Aparecer nas buscas ✅ | Estatísticas ✅ | Personalizar página ✅

**Agência/RH**: Publicar vagas ✅ | Recrutar ✅ | Buscar profissionais ✅ | Gerenciar candidatos ✅ | Cadastrar serviços ❌ | Receber leads ❌ | Página profissional ❌ | Aparecer nas buscas ❌

### 1.3 Bordas e Estilos dos Cards (ProviderCard)

A lógica de borda colorida **NÃO é baseada em tipo de conta**. A condicional é:

```
hasImages (serviceImage || hasPortfolio) ?
  'border-accent/50 ring-1 ring-accent/20'  → Borda accent (verde)
  : 'border-border'                          → Borda neutra
```

Ou seja: cards com imagens de serviço ou portfólio ganham borda accent. Cards sem imagens ficam com borda neutra. Não há diferenciação visual por plano (Premium/Trial) no card público.

### 1.4 Atribuição Automática no Cadastro

Quando um usuário se cadastra, o trigger `handle_new_user()` executa:

```
level_id  → '716c417b...' (Usuário, prioridade 10)
account_type_id → '50a97ea2...' (Trial, R$ 0,00)
profile_type → valor do meta_data ou 'client'
role → 'client' (se RH) ou profile_type
```

**Para providers**: o trigger `auto_premium_provider()` na tabela `providers` aplica:
- Se total de providers ≤ 500 OU data de cadastro ≤ 30/06/2027: `plan = 'premium'` e `featured = true`

Todos os tipos começam com **Nível: Usuário** e **Plano: Trial**. A diferença de tier (`free_client`, `free_provider`, `free_rh`) está na tabela `profile_type_settings` e é usada pelo `useAccountLimits` via views `account_model_view` e `account_limits_view`.

---

## 2. Lógica de Níveis de Acesso (Permissões)

### 2.1 Hierarquia (tabela user_levels)

| Nível | Prioridade | Permissões |
|-------|-----------|------------|
| **Administrador** (vermelho) | 100 | Criar ✅ Editar ✅ Excluir ✅ Ver Usuários ✅ Configurações ✅ Relatórios ✅ Faturamento ✅ |
| **Gerente** (amarelo) | 80 | Criar ✅ Editar ✅ Excluir ❌ Ver Usuários ✅ Configurações ❌ Relatórios ✅ Faturamento ❌ |
| **Supervisor** (roxo) | 60 | Criar ❌ Editar ✅ Excluir ❌ Ver Usuários ✅ Configurações ❌ Relatórios ✅ Faturamento ❌ |
| **Analista** (azul) | 40 | Criar ❌ Editar ❌ Excluir ❌ Ver Usuários ✅ Configurações ❌ Relatórios ✅ Faturamento ❌ |
| **Usuário** (cinza) | 10 | Criar ❌ Editar ❌ Excluir ❌ Ver Usuários ❌ Configurações ❌ Relatórios ❌ Faturamento ❌ |

### 2.2 O que cada nível pode ver no menu Gestão

O mapeamento está em `ADMIN_ROUTE_PERMISSIONS` no `usePermissions.ts`:

| Rota | Permissão Requerida | Quem acessa |
|------|---------------------|-------------|
| /admin/usuarios | `view_users` | Admin, Gerente, Supervisor, Analista |
| /admin/crm-usuarios | `view_users` | Admin, Gerente, Supervisor, Analista |
| /admin/niveis | `manage_settings` | Admin |
| /admin/tipos-conta | `manage_settings` | Admin |
| /admin/configuracoes | `manage_settings` | Admin |
| /admin/metatags | `manage_settings` | Admin |
| /admin/menus | `manage_settings` | Admin |
| /admin/modulos | `manage_settings` | Admin |
| /admin/backup | `manage_settings` | Admin |
| /admin/regras | `manage_billing` | Admin |
| /admin/estatisticas | `view_reports` | Admin, Gerente, Supervisor, Analista |
| /admin/auditoria | `view_reports` | Admin, Gerente, Supervisor, Analista |

**Nota importante**: As demais rotas admin (prestadores, serviços, leads, etc.) **NÃO estão mapeadas** em `ADMIN_ROUTE_PERMISSIONS`, ou seja, atualmente são acessíveis a qualquer admin (validação via `useAdmin` + `has_role`). O controle granular por nível só funciona nas rotas listadas acima.

### 2.3 Mudança de Nível

Para mudar o nível de um usuário:
- **No banco**: alterar `profiles.level_id` para o UUID do nível desejado
- **No admin**: via `/admin/usuarios` → Editar Usuário → selecionar Nível
- **Sem validação de segurança extra** — qualquer admin pode promover/rebaixar. Não há restrição impedindo um admin de promover alguém a Administrador. A proteção real do painel admin é via tabela `user_roles` (RBAC com `has_role()`), que é **independente** dos `user_levels`.

**Distinção crítica**:
- `user_roles` (admin/moderator/user) → controla **acesso ao painel admin** via RLS
- `user_levels` (Administrador/Gerente/...) → controla **permissões granulares dentro do painel**

---

## 3. Funcionamento do CRM e Leads

### 3.1 Fluxo de um Lead

```text
Visitante → Perfil do Prestador → Clica "Chamar no WhatsApp"
                                    ↓
                           Insere registro na tabela 'leads'
                           (client_name, phone, service_needed, provider_id)
                                    ↓
                           Lead aparece em:
                           - /admin/leads (admin)
                           - /dashboard/leads (prestador)
                           - /admin/crm-usuarios (métricas)
                                    ↓
                           Status: new → contacted → converted → closed
```

### 3.2 Quem recebe leads e quem não recebe

A decisão é feita pelo `useAccountLimits` + `tier_rules`:

| Tier | can_receive_leads | max_leads | Resultado |
|------|------------------|-----------|-----------|
| `free_client` | ❌ | 5 | Nunca recebe leads |
| `free_provider` | ❌ | 20 | **NÃO recebe leads** (switch desligado!) |
| `free_rh` | ❌ | 5 | Nunca recebe leads |
| `premium` | ✅ | -1 (ilimitado) | Recebe leads sem limite |
| `other` | ❌ | 0 | Nunca recebe leads |

**⚠️ ALERTA**: O tier `free_provider` tem `can_receive_leads = false`. Isso significa que profissionais gratuitos **não podem receber leads** pelo sistema. Na prática, o contato é feito via WhatsApp direto, mas o sistema de contagem de leads do `useResourceGate` bloquearia funcionalidades gated.

### 3.3 Métricas do CRM (/admin/crm-usuarios)

- **Crescimento**: Gráfico de área dos últimos 30 dias, contando `profiles.created_at` e `providers.created_at` por dia
- **Retenção**: Últimos 12 meses, calcula `(ativos / total acumulado) × 100`. "Ativo" = `status !== 'inactive'`
- **Distribuição por Tipo**: PieChart contando `profiles.profile_type` (client/provider/rh)
- **Funil**: Cadastrado → Perfil Completo (full_name preenchido) → Profissional Ativo (provider approved) → Premium (plan = 'premium')

---

## 4. Gestão de Serviços e Portfólio

### 4.1 Regras por Tier

| Tier | can_create_services | max_services | max_leads |
|------|--------------------:|-------------:|----------:|
| `free_client` | ❌ | 0 | 5 |
| `free_provider` | ✅ | 3 | 20 |
| `free_rh` | ❌ | 0 | 5 |
| `premium` | ✅ | -1 (∞) | -1 (∞) |
| `other` | ❌ | 0 | 0 |

### 4.2 Validação de Limites

O hook `useAccountLimits` busca dados das views `account_model_view` e `account_limits_view`, depois conta serviços reais:

```typescript
// Conta serviços do usuário
SELECT count(*) FROM services WHERE user_ref = ? AND deleted_at IS NULL

// Decisão
canCreateService = can_create_services AND (max_services == -1 OR currentServices < max_services)
```

O `useResourceGate` centraliza todas as verificações e retorna `{ allowed, reason }`.

---

## 5. Guia de Operação do Painel Admin

### 5.1 Abas da Gestão

| Aba | Rota | Função |
|-----|------|--------|
| **Prestadores** | /admin/prestadores | CRUD de providers. Aprovar/rejeitar. Editar plano, cidade, categoria. Soft-delete. |
| **Usuários** | /admin/usuarios | CRUD de profiles. Mudar tipo, nível, plano. Reset de senha. Criar usuário. |
| **Níveis** | /admin/niveis | CRUD de user_levels. Definir permissões JSONB por nível. |
| **Tipos de Conta** | /admin/tipos-conta | 5 abas: Tipos de Cadastro, Planos, Níveis, Regras Tier, Recursos. Hub central de configuração. |
| **CRM Usuários** | /admin/crm-usuarios | Dashboard analítico. Funil, crescimento, retenção, distribuição. Tags de usuários. Notificações em massa. |
| **Serviços** | /admin/servicos | Lista de todos os serviços. Editar, soft-delete. |
| **Leads** | /admin/leads | Lista de leads. Filtrar por status (new/contacted/converted/closed). Editar, excluir. Ações em massa. |
| **Planos & Regras** | /admin/regras | Edição direta dos tier_rules. Ajustar max_services, max_leads, switches. |
| **Assinaturas** | /admin/assinaturas | MRR, status de assinaturas, sincronização de acesso. |

### 5.2 Combinação: Premium + Nível Usuário

Se você muda o `account_type_id` para Premium mas mantém o `level_id` como Usuário:

- **Recursos do plano**: O usuário ganha os recursos listados no plano Premium (API Access, Priority Support, 100GB Storage, Advanced Analytics) — **mas estes são apenas labels visuais atualmente**
- **Permissões no admin**: Continua sem acesso ao painel admin (Usuário não tem nenhuma permissão)
- **Tier rules**: O tier é determinado pelo `profile_type_settings.tier_key`, **NÃO pelo account_type**. Ou seja, mudar o plano para Premium **não muda o tier automaticamente**
- **Na prática**: O plano Premium do `account_types` é um **rótulo comercial**. O que realmente controla os limites operacionais (serviços, leads) é o `tier_key` vinculado ao tipo de cadastro

**Conclusão**: Mudar alguém para "Premium" no account_type sem mudar o tier_key no profile_type_settings **não altera os limites reais**. Para dar limites ilimitados, é preciso que o tier_key seja `premium`.

---

## 6. Auditoria de Recursos e Conectividade

### 6.1 Status dos Recursos Listados

| Recurso | Status | Detalhes |
|---------|--------|----------|
| Página profissional | ✅ Funcional | `/prestador/:slug` renderiza perfil completo |
| Portfólio | ✅ Funcional | Upload de álbuns e fotos via `/dashboard/portfolio` |
| Estatísticas de perfil | ⚠️ Parcial | `provider_impressions` rastreia views, mas dashboard de stats do provider é básico |
| Personalizar página | ⚠️ Parcial | Edição de perfil existe, mas customização visual avançada (cores, layout) não está implementada |
| Cadastrar serviços | ✅ Funcional | CRUD completo com imagens |
| Receber leads | ✅ Funcional | Leads registrados via WhatsApp click tracking |
| Aparecer nas buscas | ✅ Funcional | Providers com `status=approved` aparecem |
| Publicar vagas | ✅ Funcional | Jobs com soft-delete e view_count |
| Limited Access | ⚠️ Placeholder | Label sem lógica de enforcement |
| API Access / SSO / Custom Integrations | ❌ Placeholder | Apenas labels nos planos Enterprise/Premium |
| Priority Support / Storage | ❌ Placeholder | Sem lógica implementada |

### 6.2 O que falta para CRM 100% funcional

1. **Pipeline de vendas automatizado**: Atualmente o CRM mostra métricas, mas não tem automação de follow-up (ex: notificar automaticamente leads não respondidos em 48h)
2. **Lead scoring**: Não existe pontuação automática de leads por qualidade/probabilidade de conversão
3. **Integração tier ↔ plano**: O `tier_key` do tipo de cadastro e o `account_type` operam independentemente. Mudar o plano comercial deveria propagar para o tier
4. **Automação de upsell**: Não há gatilhos automáticos para sugerir upgrade quando um provider atinge o limite de serviços
5. **Relatórios exportáveis**: O CRM não oferece export CSV/PDF das métricas
6. **Lifecycle emails**: Não há automação de e-mails baseada em estágio do funil

### 6.3 Dados Reais do Sistema (snapshot)

| Combinação | Total |
|------------|-------|
| Provider + Premium + Nível Usuário | 149 |
| Client + Trial + Nível Usuário | 49 |
| Provider + Trial + Nível Usuário | 14 |
| Provider + Premium + Nível Admin | 5 |
| RH + Agencia de RH + Nível Analista | 1 |
| **TOTAL** | **218** |

---

## Resumo Executivo

O sistema opera com **3 camadas de controle independentes** que precisam estar alinhadas para funcionar corretamente:

```text
┌─────────────────────────────────────────────────┐
│  CAMADA 1: user_roles (RBAC)                    │
│  → Controla ACESSO ao painel admin              │
│  → has_role(uid, 'admin')                       │
├─────────────────────────────────────────────────┤
│  CAMADA 2: user_levels (Permissões granulares)  │
│  → Controla O QUE pode fazer dentro do admin    │
│  → JSONB de permissions por nível               │
├─────────────────────────────────────────────────┤
│  CAMADA 3: tier_rules + profile_type_settings   │
│  → Controla LIMITES operacionais                │
│  → max_services, max_leads, can_create/receive  │
├─────────────────────────────────────────────────┤
│  CAMADA 4: account_types (Planos comerciais)    │
│  → Controla BRANDING e recursos listados        │
│  → NÃO afeta limites operacionais diretamente   │
└─────────────────────────────────────────────────┘
```

**Lacuna principal**: As camadas 3 e 4 não estão sincronizadas. Mudar o plano comercial (account_type) de um usuário não altera seu tier operacional. Para que a gestão seja 100% eficiente, seria necessário vincular `account_types` → `tier_rules` diretamente, de modo que ao atribuir um plano "Premium" a um usuário, seus limites operacionais mudem automaticamente.

