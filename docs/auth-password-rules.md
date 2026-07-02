# Auth · Regras de senha (server-side)

> Última revisão: 2026-05-02

Este documento descreve **o que está protegido no servidor** para senhas, mesmo
que o usuário burle a validação do front-end (DevTools, requests diretos à API,
etc.). Toda configuração mora no projeto Lovable Cloud (Supabase Auth).

---

## 1. Comprimento mínimo

- **Configuração**: `Auth → Password requirements → Minimum length`
- **Valor atual**: 6 caracteres
- **Recomendado**: 8+ (já permitido pelo `STRONG_PASSWORD_RULES` no front)
- **Comportamento**: Auth rejeita signup/recover com `weak_password` se a
  string enviada tiver menos caracteres que o configurado.

## 2. Composição mínima

- **Configuração**: `Auth → Password requirements → Required characters`
- **Opções suportadas pelo Supabase**:
  - `Letters and digits` (atual recomendado)
  - `Lowercase, uppercase, digits and symbols`
- **Comportamento**: rejeição imediata no `signUp` / `updateUser` quando
  faltarem categorias exigidas.

## 3. Verificação de senhas vazadas (HIBP)

- **Configuração**: `Auth → Password requirements → Check passwords against
  HaveIBeenPwned`
- **Estado atual**: ✅ **HABILITADO** (via tool `configure_auth` —
  `password_hibp_enabled: true`)
- **Comportamento**: ao tentar usar uma senha que aparece em vazamentos
  públicos (ex: `password123`, `qwerty`), o Supabase Auth retorna
  `weak_password` no signUp/updateUser. Funciona via k-anonymity (apenas o
  prefixo do hash SHA-1 sai do servidor).
- **Por que importa**: bloqueia senhas fracas mesmo se o usuário desativar
  todas as validações do `PasswordInput` no front.

## 4. Rate limit

- **Configuração**: `Auth → Rate limits` (defaults do Supabase)
- **Endpoints protegidos**: `signup`, `recover`, `verify`, `magiclink`
- **Default**: 30 requests/hora por IP
- **Como ajustar**: `Auth → Rate limits` no painel Lovable Cloud.

---

## Como o front se alinha

Componente: `src/components/auth/PasswordInput.tsx`

- Mostra checklist visual com `aria-live="polite"` + `role="status"` para
  leitores de tela.
- Regras default (`DEFAULT_PASSWORD_RULES`): mín. 6 chars, 1 letra, 1 número.
- Regras fortes (`STRONG_PASSWORD_RULES`): mín. 8 chars, maiúscula, minúscula,
  número.
- Toggle de visibilidade (`Eye`/`EyeOff`) com `aria-pressed` + `aria-label`.

> **Importante**: o front é apenas UX — quem **rejeita de fato** é o servidor.
> Mantenha o servidor sempre tão restritivo quanto (ou mais que) o front.

---

## Como auditar

Em produção, verifique:

```sql
-- Senhas resetadas nos últimos 7 dias (sinaliza usuários afetados por
-- bloqueio HIBP/regras)
SELECT count(*) FROM auth.audit_log_entries
WHERE created_at > now() - interval '7 days'
  AND payload->>'action' = 'user_recovery_requested';
```

E no painel: **Cloud → Logs → Auth → filter `weak_password`**.

---

## Referências

- [Supabase Password Requirements](https://supabase.com/docs/guides/auth/password-security)
- [HIBP Passwords API (k-anonymity)](https://haveibeenpwned.com/API/v3#PwnedPasswords)
- Lovable docs: <https://docs.lovable.dev/features/security>
