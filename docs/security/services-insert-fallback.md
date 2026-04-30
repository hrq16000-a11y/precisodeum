# Segurança do fallback INSERT em `public.services`

## Contexto

`OnboardingV2Shell.finishWizard` e fluxos de criação de serviço no wizard
priorizam o **RPC `create_service_atomic`** (caminho atômico, validações
server-side completas). Quando esse RPC falha por motivo transitório (ex:
deadlock raro, timeout), há um **fallback defensivo** que faz `INSERT` direto
em `public.services` (linha ~957 de `OnboardingV2Shell.tsx`).

Este documento confirma que o fallback é seguro contra abuso.

## Modelo de proteção (RLS confirmado em produção)

A tabela `public.services` tem RLS habilitado e as seguintes policies ativas:

| Operação | Policy | Condição |
|----------|--------|----------|
| SELECT | `Services are viewable by everyone` | `true` (público — perfil é vitrine) |
| INSERT | `Provider can manage own services` | `EXISTS (SELECT 1 FROM providers WHERE providers.id = services.provider_id AND providers.user_id = auth.uid())` AND `profile_type <> 'rh'` (ou admin) |
| UPDATE | `Provider can update own services` | mesma condição (`provider_id` pertence ao usuário) |
| UPDATE | `Admins can update all services` | `has_role(auth.uid(), 'admin')` |
| DELETE | `Provider can delete own services` | `provider_id` pertence ao usuário |
| DELETE | `Admins can delete all services` | `has_role(auth.uid(), 'admin')` |

## Cenários e resultado esperado

1. **Usuário anônimo tenta INSERT**
   → `auth.uid()` é `NULL`; o `EXISTS` falha; PostgREST retorna `42501 / new row violates row-level security policy`. **Bloqueado.**

2. **Usuário logado tenta INSERT em provider que não é dele**
   → `providers.user_id = auth.uid()` falha; mesma rejeição RLS. **Bloqueado.**

3. **Usuário com `profile_type='rh'` (agência) tenta INSERT em seu próprio provider**
   → Bloqueado pela cláusula `profile_type <> 'rh'` (RH não publica serviços diretamente).

4. **Profissional comum logado tenta INSERT em seu próprio provider** (caminho do fallback)
   → `auth.uid()` casa com `providers.user_id`, `profile_type` é `'provider'` ou `'client'` — passa. **Permitido.**

5. **Admin tenta INSERT em qualquer provider**
   → Cláusula `has_role(auth.uid(), 'admin')` libera mesmo para `rh`. **Permitido.**

## Garantias adicionais do fallback

- O `provider_id` usado no INSERT vem de `workingProviderId`, resolvido via
  `ensureProviderId(user.id)` que **só retorna provider cujo `user_id` é o
  do usuário logado** — fechando o vetor de "supor um provider_id alheio".
- O JWT é exigido (a sessão do `supabase` client usa o token do usuário).
  Sem sessão válida, o INSERT é rejeitado em `42501`.
- Não há SQL dinâmico, nem `service_role` envolvido no caminho do cliente.

## Conclusão

O fallback INSERT direto em `services` é seguro por três camadas independentes:

1. **Sessão** (precisa estar logado).
2. **RLS** (`provider_id` precisa pertencer ao próprio usuário).
3. **Política de papel** (`profile_type <> 'rh'` ou admin).

Mesmo que o código do cliente fosse adulterado para forçar um `provider_id`
arbitrário, o Postgres rejeitaria a operação. Não há ação de hardening
adicional necessária.

## Telemetria recomendada

Quando o fallback é executado (RPC falhou), o evento é registrado via
`logWizardError` com `meta.reason='realign_first_service_failed'` ou
similar — visível em `/admin/integridade`. Picos sustentados desse evento
indicam problema real no RPC e devem ser investigados em vez de toleráveis.
