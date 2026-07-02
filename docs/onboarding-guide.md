# Guia do Onboarding — Wizard unificado

> Referência curta e operacional. Para detalhes profundos, ver os arquivos
> citados em cada seção.

## 1. Porta de entrada

- Rota única: **`/cadastro-inicial`** (`src/pages/CadastroInicialPage.tsx`).
- Rota de saída: **`/onboarding-v2/sucesso`** (CTA explícito → `/dashboard`).
- Rotas legadas removidas: `/cadastro-bet`, `/onboarding-v2`, `/triagem`.
- Componente público único: **`<WizardShell>`** (`src/components/onboarding/wizard/WizardShell.tsx`).

## 2. Prop `mode` — discriminador oficial

```ts
type WizardMode = 'new_signup' | 'edit_profile' | 'add_service';
```

| Modo | Quando | Comportamento-chave |
|---|---|---|
| `new_signup` (default) | Usuário novo | Fluxo completo: triagem → criação de serviço → finalização |
| `edit_profile` | Usuário voltou para revisar/editar | `<EditModeSkipButton>` aparece em fases 100% preenchidas; pula triagem via `resolveReviewStartPhase(section)` |
| `add_service` | Perfil já existe; adicionar serviço | Mesmo fluxo de criação, sem triagem |

**Compatibilidade**: o boolean `reviewMode` continua aceito como alias deprecated → `mode='edit_profile'`. Resolução em `resolveWizardMode({mode, reviewMode})`.

**Acesso interno**: qualquer fase pode ler o modo via:
```ts
const { mode, isEditing } = useWizardMode();
```

## 3. Fases unificadas (19 + done)

Fonte de verdade: `wizardReducer.ts` → `UnifiedPhase` + `UNIFIED_PHASE_ORDER`.

```
triage_identity → triage_who → triage_client_city
  → triage_pro_kind → triage_pro_document → triage_pro_location
  → triage_celebration
  → main_action → main_kind → main_location → main_contact
  → main_service → main_service_details → main_photos
  → main_celebration
  → main_document → main_avatar → main_extras_a → main_extras_b
  → main_more_services → main_portfolio_albums → done
```

- Fases **`triage_*`** são renderizadas pelo `TriageOrchestrator` (alias interno do `BetModeShell`).
- Fases **`main_*`** são renderizadas pelo `MainOrchestrator` (alias interno do `OnboardingV2Shell`).
- Cada orquestrador tem reducer próprio; `WizardShell` reconcilia via `seedState` + `onPhaseChange`.

## 4. Gate global (read-only)

Arquivo: `src/lib/onboardingAccess.ts`. Função pura: `resolveOnboardingGateTarget`.

Decide redirecionamentos com base em:
- `profile.onboarding_completed` (fonte de verdade)
- `profile.onboarding_step >= 5`
- `profile.profile_type === 'provider'` + serviço existente
- Grace window `onboarding_completion_grace_v1` (sessionStorage, 2 min)

**Regra de ouro**: gate NUNCA escreve no banco. Self-heal idempotente vive em `src/lib/onboardingSelfHeal.ts` (chamado fora do render).

## 5. WhatsApp lock (regra imutável)

Em `Phase1Basic.tsx`: se `profile.whatsapp` já existe, o input fica `readOnly + disabled`, com ícone Lucide `Lock` e fundo `bg-muted/60`. Vale para **todos os modos exceto `new_signup` na primeira gravação**.

## 6. Botão "Pular esta etapa"

Componente: `src/components/onboarding/wizard/EditModeSkipButton.tsx`.

Visibilidade (AND):
1. `mode === 'edit_profile'`
2. `isPhaseFullyCompleted(state, phase) === true` (todos os obrigatórios da fase salvos)

Ao clicar: dispara `CustomEvent('wizard:request-skip', { detail: { phase, mode } })`. O `OnboardingV2Shell` ouve com cleanup garantido e dispara `dispatch({ type: 'NEXT' })`.

Telemetria do skip:
```json
{ "event": "skip",
  "meta": { "variant": "unified", "mode": "edit_profile",
            "reason": "data_already_exists",
            "source": "edit-mode-skip-button" } }
```

## 7. Telemetria — eventos canônicos

Tabela: `onboarding_events`. Wrapper: `phases/v2/telemetry.ts` (`trackOnboardingEvent`).

| event | Quando |
|---|---|
| `enter` | Usuário entrou na fase (1× por fase, dedupe por `lastTrackedPhase`) |
| `next` | Avançou validamente |
| `back` | Voltou (botão global ou interno) |
| `skip` | Pulou etapa opcional ou com dados existentes |
| `submit` | Submeteu formulário da fase |
| `complete` | Atingiu `done` |
| `error` | Falha de validação, save, sessão expirada, `flow_mismatch`, `zombie_timer` |
| `milestone` | Marco de pontos (BetMode) |

**Meta padrão** sempre injetada: `variant`, `flow` (sticky por sessão), `intent` (`professional`/`client`/`rh`), `source`.

## 8. Cache & versão

- `APP_VERSION = 1.1.0` (`src/lib/appVersion.ts`).
- `site_settings.app_min_version` força auto-purge via `AppVersionGate`.
- `forceClientUpdate.ts` preserva `sb-*` e `cookie_consent_v2`.
- SW desabilitado em ambientes `id-preview--*.lovable.app`.

## 9. Drafts (auto-save)

| Camada | Onde | Chave |
|---|---|---|
| Local (V3 atual) | `localStorage` | `onboarding_v3_institutional_final` |
| Local (Bet/triagem) | `localStorage` | `bet_wizard_draft_v1` |
| Remoto | `onboarding_v2_drafts` (Supabase) | scoped por `user.id` |

Purga única de chaves legadas no primeiro boot V3 via flag `onboarding_purge_v3_done`.

## 10. Zombie timer guard

`src/lib/wizardZombieGuard.ts`. Substitui `setTimeout` direto por `scheduleWizardTimeout(phase, action, delay, fn)`. Quando o timer dispara após troca de fase, registra `error/zombie_timer` com `phase_at_schedule`, `phase_at_fire`, `delay_ms`, `lag_ms`.

## 11. Finalização (`finalizeUnifiedOnboarding`)

Em `WizardShell`:
1. `markOnboardingCompletionGrace()` (sessionStorage, 2 min)
2. Limpa drafts local (`clearOnboardingV2Draft`, `clearBetDraft`, `clearSessionTouched`)
3. Limpa drafts remotos (`clearRemoteDraft`, `clearRemoteBetDraft`)
4. `UPDATE profiles SET profile_type='provider', onboarding_step=5, onboarding_completed=true`
5. Navega para destino (fail-soft: erros de update não bloqueiam navegação)

## 12. Mapa de regras × `mode`

| Regra | new_signup | edit_profile | add_service |
|---|---|---|---|
| Triagem completa (`triage_*`) | Sim | Pula via `resolveReviewStartPhase` | Pula |
| Fase inicial | `triage_identity` | `main_action`/`main_service`/`main_document`/… (por `section`) | `main_service` |
| WhatsApp lock | Só após salvar | Sempre travado | Sempre travado |
| Botão "Pular esta etapa" | Não | Sim (se fase 100% preenchida) | Não |
| `<EditModeSkipButton>` visível | Não | Sim | Não |
| Self-heal `onboarding_completed` | Pode rodar | Já é `true` | Já é `true` |
| Telemetria `meta.flow` | `unknown` ou intent | `unknown` ou intent | `unknown` ou intent |
| Drafts ativos | Sim | Não (perfil canônico) | Sim (escopados ao serviço) |

## 13. Arquivos críticos (ordem de leitura sugerida)

1. `src/components/onboarding/wizard/WizardShell.tsx` — fachada pública
2. `src/components/onboarding/wizard/wizardMode.ts` — tipo `WizardMode`, contexto, `isPhaseFullyCompleted`
3. `src/components/onboarding/wizard/wizardReducer.ts` — fases unificadas
4. `src/components/onboarding/wizard/EditModeSkipButton.tsx` — atalho explícito
5. `src/lib/onboardingAccess.ts` — gate puro
6. `src/lib/onboardingSelfHeal.ts` — migração idempotente
7. `src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx` — orquestrador main
8. `src/components/onboarding/wizard/phases/bet/BetModeShell.tsx` — orquestrador triage
9. `docs/onboarding-telemetry.md` — contrato de eventos detalhado

## 14. Constraints permanentes

- Sem emojis em nenhuma UI; usar Lucide React (PascalCase).
- Sem AI paga para descrições — templates locais apenas.
- Toda mudança de fase deve passar pelo reducer (nunca `setState` direto).
- Toda persistência crítica (`profiles`, `providers`, `services`) deve ser idempotente.
- `mode` é fonte única — não criar flags paralelas (`isReviewing`, `editing`, etc.).
