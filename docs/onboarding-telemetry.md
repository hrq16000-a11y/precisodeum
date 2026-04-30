# Telemetria do Onboarding V2 — Guia de uso

> **TL;DR**: dentro do shell V2 (`OnboardingV2Shell`), use o wrapper local
> `trackEvent`. Fora dele (BetModeShell, ExitIntentDialog, etc.), use
> `trackOnboardingEvent` direto — o `meta.flow` é injetado automaticamente
> via sticky em `sessionStorage`. Nunca envie PII em `meta`.

## Camadas

```
┌──────────────────────────────────────────────────────────────────┐
│ OnboardingV2Shell                                                │
│   trackEvent(args)  ──┐                                          │
│                       │ injeta meta.flow ('company' | 'default') │
│                       ▼                                          │
│                trackOnboardingEvent(opts)  (telemetry.ts)        │
│                       │                                          │
│                       │ se meta.flow ausente:                    │
│                       │   getOnboardingFlow() ?? 'unknown'       │
│                       │ se meta.intent ausente:                  │
│                       │   getOnboardingIntent()                  │
│                       ▼                                          │
│                supabase.from('onboarding_events').insert(...)    │
└──────────────────────────────────────────────────────────────────┘
```

## Caminhos válidos

### 1. Dentro de `OnboardingV2Shell`

Sempre usar o wrapper `trackEvent` (já injeta `meta.flow`):

```tsx
import { onboardingMeta } from './telemetryMeta';

void trackEvent({
  phase: state.phase,
  event: 'next',
  userId: user?.id,
  meta: onboardingMeta({
    field: 'whatsapp',
    valid: true,
    attempt: 1,
  }),
});
```

### 2. Fora do shell (BetModeShell, ExitIntentDialog, etc.)

`trackOnboardingEvent` direto — `meta.flow` vem do sticky:

```tsx
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';

void trackOnboardingEvent({
  phase: 'pro_location',
  event: 'enter',
  userId: user?.id,
  meta: { source: 'cep_lookup' },
  // meta.flow será 'company' ou 'default' se o V2Shell já tiver setado;
  // 'unknown' caso contrário (ex: usuário caiu direto no Bet).
});
```

### 3. Início do flow — setar o sticky

O shell faz isso automaticamente. Outros entrypoints (Bet, recovery)
podem chamar manualmente quando souberem o tipo:

```ts
import { setOnboardingFlow } from '@/components/onboarding/wizard/phases/v2/telemetry';

setOnboardingFlow('company'); // ou 'default'
```

## Campos do `meta`

| Campo          | Quando usar                                | Origem          |
|----------------|--------------------------------------------|-----------------|
| `flow`         | Sempre (auto)                              | shell ou sticky |
| `intent`       | Auto                                       | PhaseWho        |
| `draft_source` | Só em `enter`/`complete` do BetModeShell   | autodetect      |
| `duration_ms`  | Só em `phase_exit`                         | `markPhaseExit` |
| `error_code`   | Eventos `error`                            | caller          |
| `attempt`      | Eventos `error` ou `submit` reincidentes   | wizardErrorGuard|
| `action`       | Discriminador semântico ('submit_company') | caller          |

**Nunca colocar em `meta`**: nome, whatsapp, email, CPF/CNPJ, endereço,
texto livre digitado pelo usuário.

## Anti-padrões

```tsx
// ❌ Não chame supabase.insert direto na tabela onboarding_events
await supabase.from('onboarding_events').insert({ ... });

// ❌ Não duplique meta.flow manualmente — confie no wrapper/sticky
void trackEvent({ ..., meta: { flow: 'company', flow: 'default' } });

// ❌ Não envie PII
void trackEvent({ ..., meta: { whatsapp: '11999998888' } });

// ✅ Faça
void trackEvent({
  ...,
  meta: onboardingMeta({ has_whatsapp: true, length: 11 }),
});
```

## Auditoria de divergências

`OnboardingV2Shell` emite um evento `error` com
`meta.kind = 'flow_mismatch'` quando `profile.account_type` (banco)
diverge de `state.profile.kind` (reducer). Use isso para detectar
PJs caindo no fluxo PF (e vice-versa):

```sql
SELECT phase, count(*) FROM onboarding_events
WHERE meta->>'kind' = 'flow_mismatch'
  AND created_at > now() - interval '7 days'
GROUP BY phase
ORDER BY count DESC;
```

## Diagnóstico em DEV/TEST

```ts
import {
  getWizardSupabaseSummary,
  resetWizardSupabaseDiagnostics,
} from '@/components/onboarding/wizard/phases/v2/diagnostics';

resetWizardSupabaseDiagnostics();
// ... interage com o wizard ...
console.log(getWizardSupabaseSummary());
// [
//   { source: 'flushRemoteDraft', phase: 'phase2_service', count: 1, ... },
//   // se o dedupe funcionou, useRemoteDraft.debounced NÃO aparece para a mesma phase
// ]
```
