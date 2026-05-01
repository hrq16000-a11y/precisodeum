# Onboarding · API & Funções (Referência rápida)

Documentação curta dos pontos de entrada do onboarding: **Gate**, **Self-Heal**, **Telemetria**, **Guards** e **Acesso**. Use como mapa para manutenção e debugging.

> Stack: tudo client-side TypeScript. Nenhuma rota HTTP custom — escritas vão direto à tabela `onboarding_events` (telemetria) e `profiles` (self-heal) via Supabase JS SDK. Todas as funções são **fail-soft**.

---

## 1. Gate de Roteamento (`src/lib/onboardingAccess.ts`)

Decide se o usuário pode acessar a rota atual ou deve ser redirecionado para `/cadastro-inicial`. **100% read-only.**

### `resolveOnboardingGateTarget(args)`

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `profile` | `any \| null` | Linha de `profiles` do user logado |
| `hasExistingService` | `boolean` | Se já há 1 serviço ativo |
| `completionGraceActive` | `boolean` | Janela curta pós-conclusão (evita flicker) |
| `pathname` | `string` | `location.pathname` |
| `search` | `string` | `location.search` |

**Retorno**:
```ts
{ action: 'allow' | 'redirect', target: string | null, reason: string | null }
```

**Exemplo — usuário não-concluído tentando ir para `/dashboard`:**
```ts
resolveOnboardingGateTarget({
  profile: { id: 'u1', profile_type: 'provider', onboarding_completed: false },
  hasExistingService: false,
  pathname: '/dashboard',
});
// → { action: 'redirect', target: '/cadastro-inicial', reason: 'global-onboarding-gate' }
```

**Exemplo — concluído tentando reabrir `/cadastro-inicial`:**
```ts
// → { action: 'redirect', target: '/dashboard', reason: 'already-completed-blocking-cadastro-inicial' }
```

**Cenários de erro/edge**:
- `profile = null` → sempre `allow` (usuário deslogado é tratado pelo `AuthGuard`).
- `?next=/foo` inválido (`//evil.com`, `/cadastro-inicial`) → cai no fallback `/dashboard`.
- `?review=1` no path `/cadastro-inicial` → permite reentrada para edição.

### Helpers correlatos
| Função | Uso |
|---|---|
| `hasUnlockedAppAccess(profile, hasExistingService)` | Booleano: pode usar app? |
| `isOnboardingReviewMode(search)` | `?review=1` presente? |
| `getOnboardingReviewSection(search)` | Lê `?section=basic\|location\|services\|...` |
| `markOnboardingCompletionGrace()` | Liga grace de 10s pós-conclusão (sessionStorage) |
| `resolvePostLoginRoute({userId, profile, provider})` | Async — destino pós-login (consulta provider/serviço) |

---

## 2. Self-Heal (`src/lib/onboardingSelfHeal.ts`)

Migra perfis legados (provider + 1º serviço criados, mas `onboarding_completed=false`) para o estado correto. Existe para manter o Gate puro.

### `runOnboardingSelfHeal({ userId, profile, provider })`

**Pré-condições** (todas obrigatórias):
- `profile.profile_type === 'provider'`
- `profile.onboarding_completed !== true`
- Existe `provider` para o user
- Existe 1+ serviço ativo do provider

**Garantias**:
- **Idempotente**: máximo 1 execução por `userId` por aba (cache `HEALED_USERS`).
- **Coalesce**: chamadas concorrentes compartilham a mesma promise (`IN_FLIGHT`).
- **Fail-soft**: nunca lança; loga `console.warn` em falha.

**Retorno**: `Promise<boolean>` — `true` somente se houve UPDATE real (caller deve `refetchProfile`).

**Payload do UPDATE**:
```ts
supabase.from('profiles').update({
  onboarding_step: 5,
  onboarding_completed: true,
}).eq('id', userId);
```

**Erros esperados (não fatais)**:
| Causa | Comportamento |
|---|---|
| `userId` ausente / `profile` null | retorna `false` sem warn |
| Provider não encontrado | retorna `false` |
| Nenhum serviço ativo | retorna `false` |
| RLS / network error no UPDATE | `console.warn '[onboardingSelfHeal] update failed (fail-soft)'`, **não** marca como healed (permite retry) |
| Throw genérico | `console.warn '[onboardingSelfHeal] threw (fail-soft)'`, retorna `false` |

**Reset (testes)**:
```ts
import { __testing__ } from '@/lib/onboardingSelfHeal';
__testing__.reset();
```

---

## 3. Telemetria (`src/components/onboarding/wizard/phases/v2/telemetry.ts`)

Persiste eventos em `onboarding_events`. **Nunca envia PII.** Fire-and-forget.

### `trackOnboardingEvent(opts)`

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `phase` | `OnboardingPhase` | sim | Ex: `'who'`, `'basic'`, `'location'`, `'services'`, `'final'` |
| `event` | `OnboardingEventName` | sim | `enter \| next \| back \| skip \| submit \| error \| complete \| phase_exit \| abandon` |
| `userId` | `string \| null` | não | `null` quando anônimo |
| `meta` | `Record<string,unknown>` | não | Apenas counters/flags/durations — sem PII |
| `variant` | `'v1' \| 'v2'` | não | default `'v2'` |
| `intent` | `OnboardingIntent \| null` | não | Se omitido, lê sticky de `sessionStorage` |

**Auto-injeções em `meta`**:
- `intent` (sticky via `setOnboardingIntent`).
- `flow` (sticky via `setOnboardingFlow` — `'company' \| 'default' \| 'unknown'`).
- Para `event === 'error'`: garante chaves `error_code: null` e `error_message: null` (evita NULL vs ausente em GROUP BY).

**Payload final inserido em `onboarding_events`**:
```json
{
  "user_id": "uuid-or-null",
  "session_id": "uuid-por-aba",
  "variant": "v2",
  "phase": "basic",
  "event": "next",
  "meta": {
    "duration_ms": 4231,
    "intent": "professional",
    "flow": "default",
    "draft_source": "remote"
  }
}
```

### Eventos canônicos

| Evento | Quando emitir | Meta típica |
|---|---|---|
| `enter` | Fase montada | `{ draft_source }` |
| `next` | Avanço normal | `{ duration_ms? }` |
| `back` | Voltar | `{}` |
| `skip` | `<EditModeSkipButton>` ou skip programático | `{ reason: 'data_already_exists' }` |
| `submit` | Persistência iniciada | `{ target: 'profile' \| 'provider' \| 'service' }` |
| `error` | Falha de save | `{ error_code, error_message, attempt }` |
| `complete` | Wizard concluído | `{ flow }` |
| `phase_exit` | Saída da fase com timer | `{ duration_ms, draft_source }` |
| `abandon` | Reservado (exit-intent) | — |

### Sticky helpers

```ts
setOnboardingIntent('professional');     // PhaseWho decide
setOnboardingFlow('company');            // PJ vs PF
setOnboardingDraftSource('remote');      // 'none' | 'local' | 'remote' | 'seed'
markPhaseEnter('basic');                 // inicia timer
markPhaseExit('basic', { userId, meta:{ reason:'next' }}); // emite phase_exit
resetPhaseTimers();                      // testes
```

**Erros esperados**: nenhum visível. Falha de rede / RLS é silenciosa (catch vazio).

---

## 4. Guards de Estabilidade

### `wizardZombieGuard.ts`
Previne timers órfãos disparando após mudança de fase (causa clássica de loop).

```ts
setActiveWizardPhase('basic');
scheduleWizardTimeout({
  phase: 'basic',
  delayMs: 800,
  action: 'verify',
  fn: () => doSomething(),
  userId,
});
// Se a fase trocou antes do timer disparar → grava onboarding_events
// { event: 'error', meta: { error_code: 'zombie_timer', phase_at_schedule, phase_at_fire, lag_ms } }
```

### `wizardErrorGuard.ts`

| Função | Uso |
|---|---|
| `bumpErrorAttempt(phase, action)` | Conta tentativas em `sessionStorage`; reset após sucesso |
| `getErrorAttempt(phase, action)` | Lê contador atual |
| `resetErrorAttempt(phase, action)` | Zera (chamado em `safeWizardSave` no sucesso) |
| `logWizardError({phase, userId, error, context, variant})` | Atalho para `trackOnboardingEvent('error', ...)` com `attempt` injetado |
| `safeWizardSave({ run, phase, userId, ... })` | Wrapper async com try/catch + telemetria + reset de attempt |
| `softValidate(...)` | Validação não-bloqueante com toast |
| `toastErrorWithRetry({ description, onRetry })` | Toast padronizado com botão "Tentar de novo" |

**Exemplo:**
```ts
await safeWizardSave({
  phase: 'basic',
  userId,
  context: { action: 'save_profile' },
  run: async () => supabase.from('profiles').update({...}).eq('id', userId),
});
// Em erro: emite onboarding_events('error', { error_code, error_message, attempt })
// Em sucesso: resetErrorAttempt('basic', 'save_profile')
```

---

## 5. Funil de Conversão (`src/lib/conversionFunnel.ts`)

Estado leve em `sessionStorage` para suprimir exit-intents quando o usuário já interagiu com canais de ajuda.

| Função | Efeito |
|---|---|
| `markSupportContacted({ channel, intent?, phase? })` | Registra contato com suporte |
| `markHelpPageVisited({ intent?, phase? })` | Registra visita à `/ajuda` |
| `markSaveLater({ intent?, phase?, draft_id? })` | Registra "salvar e continuar depois" |
| `shouldSuppressExitIntent()` | `true` se qualquer marca recente existe |
| `resetConversionFunnelForTest()` | Reset (testes) |

---

## 6. Tabela `onboarding_events` (schema lógico)

```sql
onboarding_events (
  id          uuid pk default gen_random_uuid(),
  user_id     uuid null,           -- null para anônimo
  session_id  text not null,       -- 1 por aba
  variant     text not null,       -- 'v1' | 'v2'
  phase       text not null,
  event       text not null,
  meta        jsonb default '{}',
  created_at  timestamptz default now()
)
```

**RLS**: insert público (anon + auth); select restrito a admins. Ver `mem://funcionalidades/admin/onboarding-stats`.

**Queries úteis**:
```sql
-- Funil por intent
select meta->>'intent' as intent, phase, count(*) 
from onboarding_events 
where event in ('enter','complete')
group by 1,2;

-- Erros mais comuns
select meta->>'error_code' as code, count(*) 
from onboarding_events 
where event = 'error' 
group by 1 order by 2 desc;

-- Zombie timers
select phase, meta->>'phase_at_fire' as fired_in, count(*)
from onboarding_events
where event='error' and meta->>'error_code'='zombie_timer'
group by 1,2;
```

---

## 7. Fluxo de chamadas (cheat-sheet)

```
Login → resolvePostLoginRoute()
         ├─ tem profile completo? → /dashboard
         └─ não → /cadastro-inicial

App.tsx (toda rota) → resolveOnboardingGateTarget()
         ├─ allow → renderiza
         └─ redirect → <Navigate to=target />

CadastroInicialPage (mount) → runOnboardingSelfHeal()
         ├─ true  → refetchProfile() → Gate reavalia → /dashboard
         └─ false → segue para WizardShell

Cada fase do Wizard:
  mount    → markPhaseEnter() + trackOnboardingEvent('enter')
  submit   → safeWizardSave() → trackOnboardingEvent('submit'|'error')
  unmount  → markPhaseExit() → trackOnboardingEvent('phase_exit')
  skip     → trackOnboardingEvent('skip', { reason:'data_already_exists' })
  final    → trackOnboardingEvent('complete') + markOnboardingCompletionGrace()
```

---

## 8. Documentos relacionados

- [`docs/onboarding-guide.md`](./onboarding-guide.md) — visão geral arquitetural & modos.
- [`docs/onboarding-telemetry.md`](./onboarding-telemetry.md) — detalhes de privacidade e dimensões.
- `mem://arquitetura/wizard/modes-v1` — `WizardMode` & `EditModeSkipButton`.
- `mem://funcionalidades/wizard/zombie-timer-guard` — proteção anti-loop.
