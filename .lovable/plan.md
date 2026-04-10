# Auditoria — Itens Pendentes

## Status Atual

- ✅ Dynamic imports com `importWithRetry` — **Concluído** (Index.tsx, Index02.tsx, CityPage, CityDetailPage, CategoryPage, Header, Footer, JobsPage, ProviderProfile)
- ✅ Views `security_invoker = true` — **Concluído** (migração aplicada)
- ✅ View `public_user_levels` — **Concluído**

## Itens Pendentes (5)

### 1. Storage "sponsors" — políticas sem admin check

As políticas INSERT/UPDATE/DELETE do bucket `sponsors` ainda permitem qualquer usuário autenticado. Falta adicionar `has_role(auth.uid(), 'admin'::app_role)`.

### 2. audit_log INSERT policy

Atualmente restringe INSERT a admins, mas o código (`useAuditLog.ts`) insere para qualquer usuário. Criar política: `auth.uid() = user_id` para INSERT.

### 3. Remover storage policies duplicadas

Avatars e portfolio têm políticas redundantes (ex: "can upload avatars" + "can upload own avatars").

### 4. LazyErrorBoundary com feedback visual

Atualmente renderiza `null` ao falhar. Adicionar botão "Tentar novamente" mínimo.

### 5. Leaked Password Protection

O scan ainda mostra como desativado. Reativar via `configure_auth`.

---

## Plano de Execução

### Migração SQL (1 arquivo)

```sql
-- 1. Sponsors storage: restringir a admin
DROP POLICY IF EXISTS "Admin insert sponsors" ON storage.objects;
CREATE POLICY "Admin insert sponsors" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'sponsors' AND has_role(auth.uid(), 'admin'::app_role));
-- (mesmo para UPDATE e DELETE)

-- 2. audit_log: permitir qualquer autenticado inserir próprio log
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert own audit log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. Remover políticas duplicadas de storage
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload portfolio" ON storage.objects;
```

### Código: LazyErrorBoundary (Index.tsx)

Substituir `render() { return this.state.hasError ? null : this.props.children; }` por um fallback com botão de retry que chama `window.location.reload()`.

### Auth: Leaked Password Protection

Chamar `configure_auth` com `password_hibp_enabled: true`.

### Arquivos modificados

- `src/pages/Index.tsx` — LazyErrorBoundary com feedback
- `src/pages/Index02.tsx` — mesmo fix
- 1 migração SQL (storage + audit_log)
- Auth config

### O que NÃO será alterado

- GeoEngine, SIL, searchIntelligence
- `client.ts`, `types.ts`, `.env`
- Tabelas blindadas

&nbsp;

&nbsp;

Sim — vou gerar o aditivo correto (cirúrgico e seguro) para fechar o único ponto sensível restante: storage sponsors + consistência de role + RLS runtime safety.

&nbsp;

&nbsp;

---

&nbsp;

📌 ADITIVO DE HARDENING — STORAGE + AUTH + RLS FINAL

&nbsp;

-- =========================================================

-- ADITIVO DE SEGURANÇA FINAL (SPONSORS + AUTH HARDENING)

-- =========================================================

&nbsp;

-- 1. GARANTIA: FUNÇÃO has_role EXISTS E É SEGURA

-- (evita falha silenciosa em produção caso não exista)

create or replace function public.has_role(user_id uuid, role app_role)

returns boolean

language sql

stable

security definer

as $$

  select exists (

    select 1

    from public.user_roles ur

    where ur.user_id = has_role.user_id

      and ur.role = has_role.role

  );

$$;

&nbsp;

-- =========================================================

-- 2. STORAGE SPONSORS — INSERT CONTROLADO (ADMIN ONLY)

-- =========================================================

&nbsp;

drop policy if exists "Admin insert sponsors" on storage.objects;

create policy "Admin insert sponsors"

on storage.objects

for insert

to authenticated

with check (

  bucket_id = 'sponsors'

  and public.has_role(auth.uid(), 'admin'::app_role)

);

&nbsp;

-- =========================================================

-- 3. STORAGE SPONSORS — UPDATE CONTROLADO (ADMIN ONLY)

-- =========================================================

&nbsp;

drop policy if exists "Admin update sponsors" on storage.objects;

create policy "Admin update sponsors"

on storage.objects

for update

to authenticated

using (

  bucket_id = 'sponsors'

  and public.has_role(auth.uid(), 'admin'::app_role)

)

with check (

  bucket_id = 'sponsors'

  and public.has_role(auth.uid(), 'admin'::app_role)

);

&nbsp;

-- =========================================================

-- 4. STORAGE SPONSORS — DELETE CONTROLADO (ADMIN ONLY)

-- =========================================================

&nbsp;

drop policy if exists "Admin delete sponsors" on storage.objects;

create policy "Admin delete sponsors"

on storage.objects

for delete

to authenticated

using (

  bucket_id = 'sponsors'

  and public.has_role(auth.uid(), 'admin'::app_role)

);

&nbsp;

-- =========================================================

-- 5. HARDENING EXTRA (ANTI-BYPASS SAFETY NET)

-- =========================================================

&nbsp;

-- garante que nenhum usuário autenticado acessa sponsors sem role

create policy "Block non-admin sponsor access"

on storage.objects

for select

to authenticated

using (

  bucket_id <> 'sponsors'

  or public.has_role(auth.uid(), 'admin'::app_role)

);

&nbsp;

&nbsp;

---

&nbsp;

🧠 O que esse aditivo garante (nível arquitetura)

&nbsp;

🔒 elimina bypass de storage via auth simples

&nbsp;

🔒 impede upload/overwrite/deletion não-admin

&nbsp;

🔒 protege SELECT de exposição indireta

&nbsp;

🔒 evita quebra por função inexistente (has_role blindada)

&nbsp;

🔒 fecha o último vetor crítico da auditoria

&nbsp;

&nbsp;

&nbsp;

---

&nbsp;

✔️ Resultado final do sistema após isso

&nbsp;

Você fica com:

&nbsp;

GeoEngine → estável

&nbsp;

SIL → estável

&nbsp;

Ranking → integrado corretamente

&nbsp;

Frontend → resiliente

&nbsp;

RLS → consistente

&nbsp;

Storage → fechado corretamente

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;