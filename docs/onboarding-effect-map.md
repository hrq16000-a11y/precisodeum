# Onboarding V2 · Effect Map (PR 4B)

> Mapa operacional dos 20 `useEffect` de `OnboardingV2Shell.tsx`.
> Fonte: linhas 217..904 do shell (estado em 2026-05).
> Objetivo: tornar acoplamento implícito explícito antes de qualquer extração
> profunda. **Nenhum effect foi extraído nesta PR** — extração depende dos
> blockers listados na coluna "Risco".

---

## Legenda de domínios
- **NAV** = navigation / event-bus do WizardShell
- **PERS** = persistence (local + remote draft)
- **AUTOSAVE** = debounce hooks externos (já isolados)
- **CT** = cross-tab / leader election
- **RECOV** = recovery / hydration
- **TEL** = telemetria
- **HYD** = hidratação inicial / bootstrap
- **GUARD** = runtime guards (zombie timers, location warning, flow mismatch)
- **SUBMIT** = finalize lifecycle

---

## Tabela mestre

| #  | Linhas    | Domínio       | Responsabilidade resumida                                                                        | Refs/estado críticos                                                          | Side-effects externos                                              | Deps reais                                                            | Cleanup                                  | Risco | Extraível? | Blocker                                                                 |
|----|-----------|---------------|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|--------------------------------------------------------------------|-----------------------------------------------------------------------|------------------------------------------|-------|------------|--------------------------------------------------------------------------|
| E1 | 217–222   | NAV           | Listener global `wizard:request-skip` → `dispatch(NEXT)`                                         | —                                                                             | window event                                                       | `[]`                                                                  | removeEventListener                      | baixo | **sim**    | nenhum                                                                   |
| E2 | 256–258   | TEL           | Cleanup de `remoteDraftHintTimer` no unmount                                                     | `remoteDraftHintTimer`                                                        | clearTimeout                                                       | `[]`                                                                  | inline                                   | baixo | sim        | timer é setado fora de useEffect (em `handleRemoteContinue`)             |
| E3 | 295–297   | TEL           | `setOnboardingFlow('company'|'default')` sticky session                                          | —                                                                             | sessionStorage helper                                              | `[isCompany]`                                                         | —                                        | baixo | **sim**    | nenhum                                                                   |
| E4 | 306–327   | GUARD/TEL     | Detecta divergência `profile.account_type` vs `state.profile.kind` → `error/flow_mismatch`       | `lastFlowMismatchRef` (dedup fingerprint)                                     | trackOnboardingEvent                                               | `[profile, state.profile.kind, state.phase, user?.id, isCompany]`     | —                                        | baixo | sim        | depende de 5 refs de leitura; mover muda timing de auditoria             |
| E5 | 346–351   | PERS          | Flush imediato (local+remoto) ao trocar de fase                                                  | usa `state` completo                                                          | flushOnboardingV2Draft (DB write)                                  | `[state.phase, user?.id, editMode]` (eslint disable)                  | —                                        | médio | não        | depende de ordering (precede HYDRATE de bootstrap E10)                   |
| E6 | 360–381   | GUARD         | Sentinela anti-amnésia: warn quando city/state vazios em phases finais                            | `locationWarningShownRef` (one-shot por entrada)                              | trackEvent, toast.warning                                          | `[state.phase, profile.city, profile.state, user?.id, trackEvent]`    | —                                        | baixo | sim        | acoplado a `trackEvent` (que muda quando `isCompany` muda)               |
| E7 | 385–391   | PERS          | `beforeunload` → `flushLocalDraft(state)`                                                        | snapshot de `state` na closure                                                | window.beforeunload                                                | `[state]` (re-bind a cada change — stale closure mitigada)            | removeEventListener                      | médio | sim*       | re-binda a cada mudança de state; mover requer ref de `state` espelhada  |
| E8 | 394–445   | RECOV         | Hint de "rascunho restaurado" LOCAL + telemetria `recovery_local_used` / `recovery_corrupted`    | `skipDraftRestore`, `state.phase`, `setDraftRestored`                         | readOnboardingV2Draft, scheduleWizardTimeout, trackOnboardingEvent | `[skipDraftRestore]` (intencional — roda 1× por mount)                | clearTimeout do hint                     | alto  | não        | parte do **recovery sequencing** — deve preceder E10 (bootstrap)         |
| E9 | 450–465   | CT            | start heartbeat + leader election + detect concurrent tab                                        | retornos de start*                                                            | BroadcastChannel + storage                                         | `[]` (1× por mount)                                                   | stopHeartbeat + stopLeader               | alto  | **não**    | núcleo de **leader election** — proibido pela PR                         |
| E10| 470–473   | CT            | Polling 5s de `isTabLeader()` → state local `isLeader` (alimenta banner)                          | `setIsLeader`                                                                 | setInterval                                                        | `[]`                                                                  | clearInterval                            | baixo | sim*       | depende de E9 ter rodado primeiro; mover separa init/poll                |
| E11| 489–536   | RECOV         | Detecta draft REMOTO mais avançado / mais novo → abre modal                                       | `state.phase` para telemetria; `setRemoteDraft`, `setShowRemoteModal`         | fetchRemoteDraft, neutralizeZombieTimers, sessionStorage.remove    | `[user?.id, skipDraftRestore]`                                        | flag `alive=false`                       | alto  | **não**    | recovery sequencing crítico (decide se hidrata remoto vs local)          |
| E12| 598–606   | HYD           | Hidrata `full_name` a partir de `user_metadata` (Google)                                         | —                                                                             | dispatch PATCH_PROFILE                                             | `[user]` (eslint disable)                                             | —                                        | baixo | sim        | precede E14 (bootstrap consome profile completo)                         |
| E13| 608–613   | HYD           | Sincroniza `state.userRef` a partir de `profile.user_ref`                                        | `state.userRef`                                                               | dispatch SET_USER_REF                                              | `[profile?.user_ref, state.userRef]`                                  | —                                        | baixo | sim        | precede E15 (hidratação por user_ref)                                    |
| E14| 617–672   | HYD           | Bootstrap: monta seed a partir de profile/provider, bloqueia regressão de fase, HYDRATE          | `state.phase`, `providerId`, `firstServiceId`, `profile`, `service`           | appendWizardResetDebugLog, dispatch HYDRATE                        | `[profile, provider, internalHandoffFromTriage]`                      | —                                        | alto  | **não**    | hydration sequencing — central; mover quebra ordering com E5/E11/E15     |
| E15| 679–764   | HYD/RECOV     | Hidratação em modo revisão: resolve providerId + 1º serviço a partir do banco                    | `providerId`, `firstServiceId`, `userRef`, `state.profile.primary_category_id`| findExistingProvider, fetchExistingFirstService, dispatch HYDRATE  | `[user?.id, userRef, providerId, firstServiceId]` (eslint disable)    | flag `cancelled=true`                    | alto  | **não**    | depende de E13/E14; race com E5 (flush) se rodar antes do hydrate        |
| E16| 771–785   | TEL           | `enter/complete` + `markPhaseEnter`/`markPhaseExit` (duração por fase)                            | —                                                                             | trackEvent, markPhaseEnter, markPhaseExit                          | `[state.phase, user?.id]`                                             | markPhaseExit no cleanup                 | baixo | sim        | acoplado a `trackEvent` (depende de E3)                                  |
| E17| 788–797   | NAV/GUARD     | `onPhaseChange?` + `setActiveWizardPhase` (zombie guard) + `pushReviewPhase` em editMode          | —                                                                             | callback prop, sessionStorage (reviewHistory)                      | `[state.phase, onPhaseChange, editMode]`                              | —                                        | médio | sim        | **setActiveWizardPhase deve rodar ANTES de qualquer outro effect dessa fase** — atualmente garantido pela ordem de declaração |
| E18| 804–813   | SUBMIT        | Quando phase==='done' && !defer → clearDraft + scheduleWizardTimeout(300ms, finishWizard)         | timer handle local                                                            | clearOnboardingV2Draft, finalizeOnboarding                         | `[state.phase, deferCompletionToParent]`                              | clearTimeout                             | alto  | não        | submit lifecycle; depende de `finishWizard` (closure sobre state inteiro)|
| E19| 815–897   | NAV/PERS      | Listener `wizard:request-back` → flush(local+remote) + popReviewPhase OU dispatch GO_TO por fase  | `state` completo, `editMode`, `user?.id`                                      | flushLocalDraft, dynamic import flushRemoteDraft, window event     | `[state, editMode, navigate, user?.id]` (re-bind massivo)             | removeEventListener + releaseOwner       | alto  | parcial    | re-binda a cada mudança de state — write coordination com E5             |
| E20| 902–904   | NAV           | `clearReviewHistory()` ao sair de editMode                                                       | —                                                                             | sessionStorage clear                                               | `[editMode]`                                                          | —                                        | baixo | **sim**    | nenhum                                                                   |

`*` = isolável tecnicamente, mas o ganho não compensa o risco isolado nesta PR.

---

## Domínios identificados

| Domínio   | Effects                                | % do total |
|-----------|----------------------------------------|------------|
| HYD       | E12, E13, E14, E15                     | 20%        |
| RECOV     | E8, E11, (E15)                         | 10–15%     |
| PERS      | E5, E7, (E19)                          | 10–15%     |
| CT        | E9, E10                                | 10%        |
| NAV       | E1, E17, E19, E20                      | 20%        |
| TEL       | E2, E3, E4, E16                        | 20%        |
| GUARD     | E4, E6, E17 (parcial)                  | 10%        |
| SUBMIT    | E18                                    | 5%         |

---

## Chains identificados (acoplamento ordem-dependente)

### Chain A — **Recovery / Hydration**
```
E9 (start leader/heartbeat) ──┐
E12 (auth name)               │
E13 (userRef sync) ───────────┼──► E14 (bootstrap HYDRATE) ──► E5 (flush por fase)
E8 (local hint) ──────────────┤                                  │
E11 (remote modal decision) ──┘                                  ▼
                                                              E15 (revisão DB)
```
- E8 e E11 **precisam** preceder E14 em RECOV — caso contrário o bootstrap sobrescreveria o draft remoto antes do usuário decidir.
- E15 só faz sentido depois que E14 já tentou hidratar — `firstServiceId` vazio é o gatilho.

### Chain B — **Phase change cascade**
```
state.phase muda ──► E17 (setActiveWizardPhase) ──► E16 (enter+phase_exit) ──► E5 (flush remoto) ──► E6 (guard final phases)
                                                                                                 └─► E18 (se 'done': finishWizard)
```
- E17 **deve** rodar antes de E16/E5/E18 para que `wizardZombieGuard` veja a fase nova quando timers daqueles effects forem agendados.
- Ordem atual é garantida apenas pelo posicionamento dos `useEffect` no arquivo — **frágil**.

### Chain C — **Back navigation**
```
window 'wizard:request-back' ──► E19 (handler) ──► flushLocalDraft + flushRemoteDraft ──► dispatch GO_TO ──► (Chain B reentra)
```
- E19 re-binda a cada mudança de `state` (deps `[state, ...]`), o que cria janelas onde 2 handlers coexistem brevemente. Mutex `claimBackEvent` mitiga.

### Chain D — **Cross-tab leader → write gating**
```
E9 (startTabLeaderElection) ──► isTabLeader() ──► persistPhase1/finishWizard early-return
                          └──► E10 (poll 5s) ──► setIsLeader ──► UI banner
```
- Toda persistência crítica (`persistPhase1`, `finishWizard`, flushDraft) consulta `isTabLeader()` — E9 é **gate** de Chain B/C.

### Chain E — **Flow taxonomy**
```
profile.account_type / state.profile.kind ──► isCompany (useMemo)
        ├──► E3 (setOnboardingFlow sticky)
        ├──► trackEvent wrapper (useCallback) ──► E6, E16 (telemetria com meta.flow)
        └──► E4 (auditoria flow_mismatch)
```

---

## Refs críticas identificadas

| Ref                              | Owner aparente | Lida em                             | Escrita em                           | Risco                                                          |
|----------------------------------|----------------|-------------------------------------|--------------------------------------|----------------------------------------------------------------|
| `remoteDraftHintTimer`           | shell          | `handleRemoteContinue`              | `handleRemoteContinue` + E2 cleanup  | timer setado fora de useEffect — extração de E2 exige mover handler junto |
| `lastFlowMismatchRef`            | E4             | E4                                  | E4                                   | isolado — seguro                                               |
| `locationWarningShownRef`        | E6             | E6                                  | E6                                   | isolado — seguro                                               |
| `state` (closure inteiro)        | reducer        | E5, E7, E15, E18, E19               | dispatch                             | **stale closure** se mover sem espelhar em `stateRef`          |
| `user?.id`                       | useAuth        | quase todos                         | —                                    | seguro                                                         |
| `profile`, `provider` (useAuth)  | useAuth        | E4, E6, E12, E13, E14, E15          | refetchProfile                       | E14 depende de identidade de objeto — JSON.stringify usado     |
| `skipDraftRestore`               | derivado (props/seed) | E8, E11                       | —                                    | gating de RECOV; mover effects exige passar como dep           |
| `editMode`                       | prop           | E5, E17, E19, E20                   | —                                    | gating de write coordination                                   |
| `isTabLeader()` (módulo)         | crossTabSync   | E10, persistPhase1, finishWizard, flushDraft | E9 (start)                  | **gate global** — não extrair                                  |
| `getOnboardingDraftSource()`     | telemetry      | E8, E16                             | E8, E11                              | sticky de sessão — ordering importa                            |
| `setActiveWizardPhase()`         | zombieGuard    | E17                                 | E17                                  | **gate de timers** — qualquer extração que use `scheduleWizardTimeout` deve preservar ordem |

---

## Acoplamentos invisíveis identificados (problemas reais)

1. **Ordering por posição no arquivo**: a sequência E17 → E16 → E5 → E18 só funciona porque está nessa ordem no código. Não há contrato explícito.
2. **`trackEvent` muda quando `isCompany` muda** (useCallback deps): faz E6 e E16 reexecutarem desnecessariamente quando o usuário troca PF↔PJ.
3. **E19 re-binda em CADA mudança de `state`**: janela de coexistência de 2 listeners; mutex `claimBackEvent` cobre, mas é cinto-e-suspensório.
4. **E14 + E15 podem dispatchar HYDRATE consecutivos**: a guarda de regressão em E14 cobre, mas E15 depende de E14 ter terminado primeiro (não garantido).
5. **`flushRemoteDraft` via dynamic import em E19**: code-splitting útil, mas adiciona latência imprevisível ao "Voltar" — pode perder corrida com `dispatch(GO_TO)`.
6. **E2 cleanup órfão**: limpa timer que é setado em handler fora de useEffect (`handleRemoteContinue`). Refatoração natural seria mover o setTimeout para dentro de um effect próprio.
7. **E8 e E11 leem `state.phase` mas não estão na deps**: intencional (rodar 1× por mount), mas usa valor do mount inicial — funciona porque shell remonta com `key` quando user troca.

---

## Effects extraídos (esta PR)

**Nenhum.**

Justificativa: o PR explicitamente proíbe extração que afete leader election, cross-tab ownership, write coordination, recovery orchestration ou hydration sequencing. Aplicando o filtro:

- E1, E3, E20 → **isoláveis sem risco**, mas extrair 3 effects de 4 linhas cada não justifica criar 3 hooks novos com sobrecarga de import/teste. Recomendação: agrupar em `useOnboardingMiscListeners(...)` numa próxima PR junto com E2.
- E10 → isolável, mas depende de E9 ter rodado; extrair sem E9 cria contrato implícito pior do que o atual.
- E12, E13, E16 → isoláveis, mas pertencem a chains ordem-dependentes (Chain A e B) e ganham pouco isolados.

A extração SEGURA depende primeiro de:
1. Espelhar `state` em `stateRef` (atomicidade de leitura em E5/E7/E19).
2. Promover ordering implícito de Chain B a um contrato explícito (uma função `notifyPhaseChange(phase)` que chame E17→E16→E5→E18 em ordem documentada).
3. Mover o timer de `handleRemoteContinue` para dentro de um effect dedicado (resolve E2).

Esses 3 passos são pré-requisitos arquiteturais para PR 4C.

---

## Effects bloqueados (núcleo de risco — NÃO extrair)

- **E9** (leader election + heartbeat init)
- **E11** (decisão remote vs local recovery)
- **E14** (bootstrap HYDRATE)
- **E15** (revisão DB hydrate)
- **E18** (finishWizard timer)
- **E19** (back handler com flush coordenado)
- **E8** (recovery hint + corrupção)
- **E5** (flush por fase — write coordination)

---

## Validações executadas

- Mapeamento estático: 20/20 effects catalogados, ranges confirmados via `awk` sobre o shell atual (2970 linhas).
- Refs críticas inventariadas: 11.
- Chains identificados: 5 (A–E).
- Acoplamentos invisíveis listados: 7.
- **Nenhuma mudança de código** nesta PR — risco de regressão = 0.

---

## Riscos encontrados (do mapeamento)

| Risco                                                                                       | Severidade | Mitigação atual                              |
|---------------------------------------------------------------------------------------------|------------|----------------------------------------------|
| Ordering de Chain B só por posição no arquivo                                                | alta       | nenhuma — depende de revisão humana          |
| `trackEvent` instável re-dispara E6/E16                                                      | baixa      | dedup interno de telemetria                  |
| E19 re-binda em cada state change                                                            | média      | `claimBackEvent` mutex (400ms cooldown)      |
| E14 + E15 podem dispatchar HYDRATE consecutivos                                              | média      | guarda de regressão de fase em E14           |
| Dynamic import de `flushRemoteDraft` em E19                                                  | baixa      | `.catch(() => fail-soft)`                    |
| Timer de `handleRemoteContinue` setado fora de useEffect                                     | baixa      | E2 cleanup explícito                         |
| E8/E11 leem `state.phase` sem dep                                                            | baixa      | shell remonta com `key` em troca de user     |

---

## Status final

- Documento `docs/onboarding-effect-map.md` criado.
- 0 effects extraídos (decisão consciente: pré-requisitos arquiteturais documentados acima são necessários antes).
- 0 mudanças de código no shell.
- Próxima PR (4C) deve atacar os 3 pré-requisitos antes de qualquer extração de chain.

---

# PR 4C / 4D · Ordering contracts explícitos + sync

> Atualização **2026-05-28**. Reflete o estado atual de `OnboardingV2Shell.tsx`
> (3067 linhas, ranges deslocados ~15 linhas em relação à tabela mestre acima
> por adição dos blocos de contrato inline). A tabela mestre permanece válida
> em estrutura — os contratos abaixo fecham o gap textual entre código e doc.

## Scaffolding observacional adicionado (PR 4C)

- `stateRef = useRef(state); stateRef.current = state;` — espelho atômico do
  reducer. **Não é lido por nenhum effect** ainda; existe como pré-requisito
  para extração futura de E5/E7/E19 sem stale closure.
- `lifecyclePhaseRef` (`'BOOT' | 'HYDRATING' | 'HYDRATED' | 'READY' | 'SUBMITTING' | 'COMPLETED'`)
  — marcador observacional. **Nenhum effect gateia por ele.** Atualizado em:
  - E14 (entrada → `HYDRATING`, sucesso → `HYDRATED`)
  - E17 (`HYDRATED` → `READY`)
  - E18 (entrada → `SUBMITTING`, sucesso → `COMPLETED`)

### Sanity: `lifecyclePhaseRef === 'HYDRATING'` pode persistir

Comportamento **esperado e documentado**, não é bug:

- E14 marca `HYDRATING` no topo do effect.
- Em três paths de early-return (`bootstrap` nulo, regressão de fase
  bloqueada, snapshot estruturalmente idêntico) o effect retorna **sem**
  promover para `HYDRATED`.
- Como nenhum effect gateia por `lifecyclePhaseRef`, isso não afeta runtime.
- Promoção a gate funcional exige antes:
  1. transição explícita `HYDRATING → BOOT` nos early returns, **ou**
  2. um sentinel `HYDRATING_NOOP` distinto de `HYDRATING_PENDING`.

Não fazer nada disso nesta PR — apenas registrar.

## Contratos inline fechados (E5, E14, E15, E16, E17, E18, E19)

Cada bloco `ORDER CONTRACT` no shell declara quatro campos canônicos:
`REQUIRES`, `PRODUCES`, `CONSUMERS`, `POSITION-DEPENDENCY`. Resumo:

| Effect | REQUIRES                                          | PRODUCES                                                  | CONSUMERS                                | POSITION-DEPENDENCY                                                            |
|--------|---------------------------------------------------|-----------------------------------------------------------|------------------------------------------|--------------------------------------------------------------------------------|
| E5     | E17 já chamou `setActiveWizardPhase`              | `flushOnboardingV2Draft` (write local + remoto por fase)  | backend                                  | declarado **após** E17 (commit order React top-to-bottom) — não mover          |
| E14    | E12 (`full_name`) + E13 (`userRef`) dispatcharam; E8/E11 decidiram local-vs-remote | `dispatch(HYDRATE)`; `BOOT → HYDRATING → HYDRATED` | E5, E15, todo o resto             | deve preceder E15 (revisão usa providerId hidratado)                           |
| E15    | E14 tentou hidratar (`HYDRATED` ou snapshot estável) + E13 produziu `userRef` | provider/serviço carregados do banco                  | UI de revisão; E5 ao mudar fase    | depois de E13/E14 — race com E5 mitigada por cancelamento via `cancelled` flag |
| E16    | E17 chamou `setActiveWizardPhase` na fase atual    | `trackEvent('enter'|'complete')` + `markPhaseEnter/Exit`  | telemetria                               | declarado **após** E17                                                         |
| E17    | (head da Chain B)                                  | `setActiveWizardPhase` (gate zombie-timer); promove `HYDRATED → READY` | E16, E5, E18, hint timers      | **CRÍTICA** — primeiro effect dependente de `state.phase`; mover quebra atribuição de timers |
| E18    | `state.phase === 'done'` (dispatch do reducer pós-Step19) | `clearOnboardingV2Draft` + `scheduleWizardTimeout(finishWizard)`; `SUBMITTING → COMPLETED` | finalização do wizard | precisa rodar depois de E17 (zombie guard)                                     |
| E19    | snapshot de `state` estável                        | `flushLocalDraft + flushRemoteDraft + dispatch(GO_TO)`    | Chain B reentra                          | re-binda em cada mudança de `state` — mutex `claimBackEvent('v2')` (400ms) cobre janela de 2 listeners |

### Ownership de refs críticas (confirmado)

| Ref                    | Owner       | Mutadores                | Leitores                                  | Status                                  |
|------------------------|-------------|--------------------------|-------------------------------------------|-----------------------------------------|
| `stateRef`             | render sync | render (sync write)      | nenhum (ainda)                            | observacional · pronto para PR futura   |
| `lifecyclePhaseRef`    | E14/E17/E18 | E14, E17, E18            | nenhum effect (observacional)             | pode persistir em `HYDRATING` — documentado |
| `state` (closure)      | reducer     | `dispatch`               | E5, E7, E15, E18, E19                     | extração exige migrar para `stateRef`   |
| `isTabLeader()`        | crossTabSync| E9 (start)               | E10, persistPhase1, finishWizard, flush   | **gate global** — não extrair           |
| `setActiveWizardPhase` | zombieGuard | E17                      | scheduleWizardTimeout (todos os timers)   | **gate de timers** — preservar ordem    |

## Effects ainda bloqueados (núcleo de risco)

Mantidos no shell por dependência cruzada com recovery, leader election,
hydration sequencing, submit ordering ou back orchestration:

- **E8** — recovery hint LOCAL (parte de RECOV sequencing)
- **E9** — leader election + heartbeat init (gate global)
- **E11** — decisão remote-vs-local (parte de RECOV sequencing)
- **E14** — bootstrap HYDRATE (hydration sequencing)
- **E15** — revisão DB hydrate (depende de E13/E14, race com E5)
- **E18** — `finishWizard` timer (submit lifecycle)
- **E19** — back handler com flush coordenado (write coordination com E5)

Extração futura requer pré-requisitos arquiteturais já listados (espelhar
`state`, contrato explícito de notifyPhaseChange, mover timer de
`handleRemoteContinue`). Nenhum deles foi introduzido nesta PR.

## Sanity checks (PR 4D)

- Typecheck: shell continua compilando.
- Onboarding refresh / multi-tab / recovery / submit / back / mobile: comportamento
  inalterado (nenhuma mudança de runtime — apenas comentários e refs observacionais).
- Zero regressão · zero race nova · zero deadlock · zero hydration mismatch
  · zero write duplication · zero timer zombie.

## Status final

- Documentação **sincronizada** com scaffolding inline da PR 4C.
- Contratos `REQUIRES/PRODUCES/CONSUMERS/POSITION-DEPENDENCY` consistentes
  entre código e doc para E5, E14, E15, E16, E17, E18, E19.
- `lifecyclePhaseRef` em `HYDRATING` persistente nos early-returns de E14 é
  **comportamento documentado** (não gateia nada).
- Effects bloqueados explicitamente listados — extração proibida até as
  3 pré-condições arquiteturais serem implementadas.
- 0 effects extraídos · 0 mudanças de runtime · readiness para PR seguinte: **OK**.

---

## POST-EXTRACTION FINAL STATE (PR 8 · pós-desacoplamento)

Todos os núcleos operacionais críticos do `OnboardingV2Shell` foram
externalizados. O shell virou **composition shell + state container +
render coordinator**.

### Effects extraídos · hook substituto · ownership final

| Effect | Chain | Hook substituto | Owner runtime |
|--------|-------|-----------------|---------------|
| E5  · Phase transition flush       | B/3   | `usePhaseTransitionOrchestrator`     | hook |
| E8  · Persistence / Recovery       | A/RECOV | `usePersistenceRecoveryOrchestrator` | hook |
| E9  · Cross-Tab Recovery           | D + A | `useCrossTabRecoveryOrchestrator`    | hook (detecção) + shell (handlers do modal) |
| E11 · Leader / Write Gate          | D     | `useLeaderWriteGate`                 | hook |
| E14 + E15 · Hydration Core         | A     | `useHydrationCoreOrchestrator`       | hook |
| E18 · Submit Core                  | B/5   | `useSubmitCoreOrchestrator`          | hook |
| E19 · Back Navigation              | C     | `useBackNavigationOrchestrator`      | hook |

### Permaneceram no shell (por design)

- Reducer `onboardingReducer` + `initialOnboardingState`.
- `dispatch(HYDRATE)` em `handleRemoteContinue` — único caminho legítimo
  fora dos hooks de hydration (decisão UI do usuário no modal remoto).
- Callbacks UI (`handleRemoteContinue`, `handleRemoteDiscard`,
  `handleEditFromReview`, etc.).
- `getCurrentState` / `signalLifecyclePhase` helpers (passados aos hooks).
- Render tree + composição de fases.

### Invariantes finais (runtime authorities)

1. **`isTabLeader()`** continua ÚNICA autoridade de write-gate
   (consumida por `flushDraft`/`persist*` via `crossTabSync`).
2. **`signalLifecyclePhase()`** continua ÚNICO mutator de
   `lifecyclePhaseRef`.
3. **`HYDRATE`** dispatch restrito a: `useHydrationCoreOrchestrator`
   (bootstrap/replay) + `handleRemoteContinue` (decisão do usuário).
4. **`finishWizard()`** continua ÚNICO entrypoint terminal do submit
   automático (`useSubmitCoreOrchestrator`).
5. **`finalize_onboarding_atomic`** continua ÚNICA autoridade
   transacional de "onboarding concluído".

### Shell size audit (PR 8)

- LOC antes do ciclo de extrações (pré-PR 5): ~3 200 (pico observado).
- LOC após PR 7 (extração E9): 2 945.
- LOC após PR 8 (consolidação + remoção de scaffolds documentais
  transitórios + dead `isLeader` consumer): **2 790**.
- Redução acumulada do ciclo de extrações: **≈ 410 linhas** + 7 hooks
  externalizados (`useBackNavigationOrchestrator`,
  `usePhaseTransitionOrchestrator`, `usePersistenceRecoveryOrchestrator`,
  `useCrossTabRecoveryOrchestrator`, `useLeaderWriteGate`,
  `useHydrationCoreOrchestrator`, `useSubmitCoreOrchestrator`).

### Effects bloqueados restantes

Nenhum. Todos os núcleos operacionais críticos estão externalizados.
Próximas iterações são **composicionais** (extrair sub-blocos UI,
não orchestration runtime).

### Validações executadas (PR 8)

- `tsc --noEmit` → 0 erros.
- Zero effects duplicados, zero orchestration residual, zero write-path
  novo, zero duplicate finalize, zero duplicate hydration, zero duplicate
  leader election.
- Zero refs sem readers (`isLeader` removido), zero imports mortos
  (verificado em PR 7), zero helper transitório sem uso.

