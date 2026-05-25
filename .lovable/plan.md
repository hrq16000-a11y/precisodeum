# Containment Patch — Onboarding (Stop-Loss)

Objetivo: parar sangramento em 5 pontos críticos sem refactor. Cada item lista
arquivo, mudança, risco e plano de rollback. Nada além desta lista será tocado.

## Resolução da contradição PHASE_ORDER

A regra #2 diz "não quebrar PHASE_ORDER atual" e o Crítico #1 pede uma fase
nova `phase_repair_contact`. Resolvo assim, da forma menos invasiva:

- A fase de reparo é **opcional e fora do fluxo linear**: NÃO entra em
  `PHASE_ORDER` (não muda contagem de barra, nem ordem do `NEXT`).
- É uma **fase auxiliar** acessível só via `GO_TO` quando o erro
  `whatsapp_required`/`invalid_whatsapp` é detectado, e retorna via `GO_TO`
  para a fase de origem (guardada em `state.returnToPhase`).
- Isso preserva 100% do funil atual e evita renumerar progresso/telemetria.

Se você preferir que ela entre em `PHASE_ORDER`, me avise antes — é trivial,
mas reabre a discussão de progresso global e quebra dashboards de funil.

## Mudanças por item

### Crítico #1 — Dead-end do WhatsApp

**Arquivos**:
- `src/components/onboarding/wizard/phases/v2/types.ts`
  - Adicionar `'phase_repair_contact'` ao tipo `OnboardingPhase`.
  - Adicionar campo opcional `returnToPhase?: OnboardingPhase` no `OnboardingState`.
- `src/components/onboarding/wizard/phases/v2/state.ts`
  - **NÃO** adicionar ao `PHASE_ORDER` (mantém regra #2).
  - Estender reducer com action `RETURN_FROM_REPAIR` (volta para `returnToPhase`).
- `src/components/onboarding/wizard/phases/v2/PhaseRepairContact.tsx` (NOVO, ~120 linhas)
  - Input único WhatsApp + máscara BR (reusa `formatWhatsappBR` já existente).
  - Validação local (`getOnboardingContactValidation`).
  - Botão "Salvar e voltar" → `PATCH_PROFILE` + `RETURN_FROM_REPAIR`.
- `src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx`
  - Render switch ganha case `phase_repair_contact`.
  - `REASON_MAP` para `whatsapp_required`/`invalid_whatsapp` aponta para
    `phase_repair_contact` (remove referências mortas a `phase1_basic`).
  - Botão "Voltar e corrigir" passa a salvar `returnToPhase = state.phase` e
    despachar `GO_TO phase_repair_contact`.
  - `requestWizardBackForPhase` corrigido para usar `info.backPhase`.

**Risco**: baixo. Fase nova é isolada e só aparece sob erro. Rollback: deletar
arquivo + remover case do switch + reverter REASON_MAP.

### Crítico #2 — Persistência tardia do 1º serviço

**Arquivos**:
- `src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx`
  - Adicionar `persistFirstServiceEarly()` chamado no `onNext` de `Phase2Service`
    (transição `phase2_service → phase2_details`).
  - Idempotência: se `state.firstServiceId` já existe, NOOP.
  - Reusa `buildPersistFirstServiceOperation` já existente (mesma RPC
    `create_service_atomic`, mesmo caminho que o celebration usa).
  - Em caso de falha: NÃO avança, exibe `errorModal`, registra
    `error/early_service_persist_failed`.
- `Phase3Celebration.tsx`: NÃO mexer; já é idempotente via `findExistingFirstService`.

**Risco**: médio. Mitigação: o INSERT atômico já é o mesmo usado hoje na
Phase3; só estamos antecipando. A idempotência por `(userRef, slug)` já está
implementada no RPC. Rollback: remover a chamada antecipada — celebration
continua funcionando.

### Crítico #3 — Falso "rascunho recuperado"

**Arquivo**: `src/components/onboarding/wizard/phases/v2/useOnboardingV2Draft.ts`

- `readOnboardingV2Draft` ganha guard de conteúdo mínimo. Retorna `null` se
  não houver pelo menos um de: `service.service_name` (≥3), `profile.whatsapp`
  (≥10 dígitos), ou `service.category_ids.length > 0`.
- Banner/toast "rascunho restaurado" no Shell já é condicional a `draft != null`,
  então automaticamente para de mentir.

**Risco**: baixo. Drafts genuínos têm pelo menos um desses campos. Rollback:
reverter o guard.

### Crítico #4 — Race condition local × remoto

**Arquivo**: `src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx`
(bloco de hidratação remota, junto do `fetchRemoteDraft`).

- Envelope local já tem `savedAt` (timestamp). Comparar `localDraft.savedAt`
  com `remoteDraft.updated_at` (ISO → ms). Se local for **mais novo**, NÃO
  abrir `RemoteDraftRecoveryModal` e descartar remoto na sessão.
- Flag `hydrationDoneRef` impede 2ª hidratação remota acidental.

**Risco**: baixo. Apenas inverte critério de "ganhador" quando há ambos.
Rollback: remover comparação.

### Crítico #5 — Erro remoto silencioso

**Arquivo**: `src/components/onboarding/wizard/phases/v2/useOnboardingV2RemoteDraft.ts`

- `catch` do upsert: além do `console.error`, chamar
  `trackOnboardingEvent({ event: 'error', meta: { kind: 'remote_draft_failed', code, message } })`.
- Retry simples: 1 nova tentativa após 1500ms (backoff fixo único), sem loop.

**Risco**: muito baixo. Telemetria + 1 retry. Rollback trivial.

## Testes de regressão (novos)

`src/test/containment-onboarding-stop-loss.test.ts(x)`:

1. WhatsApp ausente → REASON_MAP leva a `phase_repair_contact`, campo existe.
2. "Voltar e corrigir" → `requestWizardBackForPhase` recebe `info.backPhase`.
3. `Phase2Service.onNext` chama persist e popula `firstServiceId` antes de avançar.
4. INSERT do 1º serviço é idempotente (segundo `onNext` não cria duplicata).
5. Refresh em `phase2_photos` mantém `service.service_name`.
6. `readOnboardingV2Draft` retorna `null` quando draft vazio/parcial.
7. Local `savedAt` > remoto `updated_at` → modal de recuperação NÃO abre.
8. Falha no upsert remoto registra `error/remote_draft_failed` e tenta retry.

## Fora de escopo (explicitamente NÃO mexer)

Schema do banco, migrations, upload de fotos, autenticação, design visual,
Bet Mode, providers/profiles além do necessário para o INSERT antecipado,
`PHASE_ORDER` linear, tipos globais fora dos 2 campos novos acima.

## Ordem de execução

1. Tipos + reducer + PhaseRepairContact (Crítico #1 parte estrutural).
2. Shell: REASON_MAP + render switch + requestWizardBackForPhase (Crítico #1 fim).
3. Shell: persist antecipado em `phase2_service.onNext` (Crítico #2).
4. `useOnboardingV2Draft` guard (Crítico #3).
5. Shell: comparação de timestamps na hidratação (Crítico #4).
6. `useOnboardingV2RemoteDraft` telemetria + retry (Crítico #5).
7. Testes Vitest.

Total estimado: ~9 arquivos tocados + 2 novos (PhaseRepairContact + teste).
Zero migrations. Zero mudança em PHASE_ORDER. Zero refactor.

## Pergunta de bloqueio

Confirma a decisão de manter `phase_repair_contact` **fora** do `PHASE_ORDER`
(como fase auxiliar acessível via erro)? Se sim, executo nesta ordem.
