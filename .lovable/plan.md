

# Ajustar Permissões Padrão de admin_panel e sponsor_panel

## Contexto

Todos os perfis atualmente têm `admin_panel: true` e `sponsor_panel: true` no JSONB `permissions`, incluindo usuários comuns. Isso permite que qualquer pessoa veja itens de menu administrativo (mesmo que RLS bloqueie os dados).

- **5 admins** identificados na tabela `user_roles`: `d80784da`, `44aa54b7`, `3c8c1e5e`, `065424cb`, `b65902b8`
- **0 patrocinadores** vinculados em `sponsor_contacts`
- Todos os demais (~50+ perfis) devem ter `admin_panel: false` e `sponsor_panel: false`

## Plano

### 1. Migração — Alterar o DEFAULT da coluna `permissions`

Mudar o valor padrão da coluna JSONB `permissions` na tabela `profiles` para que `admin_panel` e `sponsor_panel` sejam `false`:

```sql
ALTER TABLE public.profiles 
ALTER COLUMN permissions 
SET DEFAULT '{"jobs":true,"plan":true,"leads":true,"my_page":true,"profile":true,"reviews":true,"services":true,"community":true,"dashboard":true,"admin_panel":false,"notifications":true,"sponsor_panel":false}'::jsonb;
```

### 2. UPDATE — Corrigir perfis existentes não-admin

Atualizar todos os perfis que **não** são admin para ter `admin_panel: false` e `sponsor_panel: false`:

```sql
UPDATE public.profiles
SET permissions = permissions || '{"admin_panel": false, "sponsor_panel": false}'::jsonb
WHERE id NOT IN (
  SELECT user_id FROM user_roles WHERE role = 'admin'
);
```

### 3. Atualizar o trigger `handle_new_user()`

Garantir que o trigger use o novo default (com `admin_panel: false` e `sponsor_panel: false`). Como o trigger faz INSERT sem especificar `permissions`, ele já herdará o novo DEFAULT da coluna — **nenhuma alteração no trigger é necessária**.

### Resultado

- Novos cadastros nascem com `admin_panel: false` e `sponsor_panel: false`
- Perfis existentes não-admin perdem acesso visual ao painel admin e sponsor
- Os 5 admins mantêm `admin_panel: true` e `sponsor_panel: true`
- Nenhuma alteração de código frontend necessária (o hook `usePermissions` já verifica esses campos)

## Detalhes técnicos

- **Arquivo afetado**: nenhum (apenas banco de dados)
- **1 migração** para alterar o DEFAULT da coluna
- **1 UPDATE** via insert tool para corrigir dados existentes

