

## Plano: Consistencia Final — Identidade, Idempotencia e Auditoria

### Diagnostico confirmado

Apos analise dos arquivos, confirmo os 5 problemas estruturais:

1. **entity_ref inconsistente**: AvatarUpload usa `userId`, PortfolioUpload usa `userId`, ServiceImageUpload usa `serviceId` — sem padrao
2. **user_ref fallback "unlinked"** ainda usado como padrao estrutural
3. **Uploads nao idempotentes**: `Date.now()-filename` gera duplicatas em retry
4. **Subscription trial sem protecao** contra double-submit
5. **Audit log incompleto**: sem eventos de media ou subscription_created

---

### Correcoes (4 blocos)

#### 1. Padronizar identidade em media inserts (3 arquivos)

**Regra unica**:
- `user_ref` = SEMPRE `profiles.user_ref` (nunca fallback "unlinked" em uploads de usuario)
- `entity_ref` = `provider_id` quando existir, senao `profile.id`
- `entity_type` = mantido como esta (profile, portfolio, service)

**Arquivos**:
- `AvatarUpload.tsx`: buscar provider_id se existir, usar como entity_ref; user_ref ja busca de profiles
- `PortfolioUpload.tsx`: `entity_ref` = `providerId` (ja recebe como prop), remover fallback "unlinked" — se user_ref null, nao inserir media (erro silencioso)
- `ServiceImageUpload.tsx`: ja correto (entity_ref=serviceId, user_ref de profiles) — apenas remover fallback null silencioso

#### 2. Idempotencia em uploads (3 arquivos)

**Estrategia**: Antes de inserir na tabela `media`, verificar se `storage_path` ja existe. Se existir, fazer `update` (public_url, is_active=true) em vez de `insert`.

**Arquivos**:
- `AvatarUpload.tsx`: upsert por storage_path
- `PortfolioUpload.tsx`: upsert por storage_path
- `ServiceImageUpload.tsx`: upsert por storage_path

Extrair funcao utilitaria `upsertMedia()` para evitar duplicacao de logica.

#### 3. Protecao de subscription trial (1 arquivo)

**Arquivo**: `SignupPage.tsx`
- Antes do insert, verificar: `select count from subscriptions where provider_id = X and status in ('trial','active')`
- Se existir, skip insert

#### 4. Eventos de auditoria estruturais (1 arquivo)

**Arquivo**: `useAuditLog.ts`
- Adicionar tipos: `media_uploaded`, `media_deleted`, `subscription_created`
- Os componentes de upload e signup passam a chamar `logAuditAction` para estes eventos (non-blocking, try/catch)

**Integracao nos uploads** (non-blocking):
- `AvatarUpload.tsx`: `logAuditAction({ action: 'media_uploaded', resource_type: 'avatar' })`
- `PortfolioUpload.tsx`: `logAuditAction({ action: 'media_uploaded'/'media_deleted', resource_type: 'portfolio' })`
- `SignupPage.tsx`: `logAuditAction({ action: 'subscription_created', resource_type: 'subscription' })`

---

### Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| `src/lib/mediaUtils.ts` | Criar — funcao `upsertMedia()` centralizada |
| `src/components/AvatarUpload.tsx` | Editar — usar upsertMedia, entity_ref=provider_id, audit |
| `src/components/PortfolioUpload.tsx` | Editar — usar upsertMedia, entity_ref=providerId, audit |
| `src/components/ServiceImageUpload.tsx` | Editar — usar upsertMedia |
| `src/pages/SignupPage.tsx` | Editar — guard de subscription duplicada, audit |
| `src/hooks/useAuditLog.ts` | Editar — novos tipos de evento |

### Nenhuma migracao SQL necessaria
Todas as tabelas e colunas ja existem.

### Resultado esperado
- 100% dos media inserts usam `profiles.user_ref` (sem "unlinked" em uploads de usuario)
- `entity_ref` padronizado: provider_id quando existir
- Retry de upload = update, nao duplicacao
- Subscription trial criada apenas 1x por provider
- Auditoria cobre upload, delete de media e criacao de subscription

