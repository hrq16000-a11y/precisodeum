---
name: Wizard zombie timer guard
description: Instrumentação para detectar timers do onboarding que disparam após troca de fase
type: feature
---

# Wizard Zombie Timer Guard

Util `src/lib/wizardZombieGuard.ts` com `setActiveWizardPhase` e `scheduleWizardTimeout` registra `event=error / error_code=zombie_timer` em onboarding_events quando um setTimeout dispara após troca de fase. Meta inclui `phase_at_schedule`, `phase_at_fire`, `delay_ms`, `lag_ms`, `phase_changed_ago_ms` e `action`.

## Aplicado em
- **Shell**: `OnboardingV2Shell` registra fase ativa em `useEffect` de `state.phase` + envolve hint local (5s), hint remoto (6s) e finishWizard (300ms).
- **PhaseWho / PhaseProKind / SaveLaterDialog**: transições com 250ms.
- **Phase4Final**: verifyDelay e auto-advance de doc (250ms).
- **Phase3Celebration**: copy-reset (2000ms).
- **Phase2Service**: saveTimer/hideHintTimer (700ms/1800ms) + advance/submit unlock (`runIfStale: true`, 600ms/1500ms).
- **ExitIntentDialog**: saveLater (50ms).
- **CepSuggestionCard**: debounce de lookup (600ms).
- **Auto-save (4 hooks)**: `useOnboardingV2Draft`, `useOnboardingV2RemoteDraft`, `useBetDraft`, `useBetRemoteDraft` — todos com `runIfStale: true` para nunca perder o save, mas ainda registrar telemetria quando dispararem fora da fase.

## Política runIfStale
- **default (false)**: callback é suprimido se a época mudou — usado para UI/transitions cujo efeito ficaria errado em outra fase.
- **runIfStale: true**: callback executa ainda assim — usado em saves (perda de dados é pior que log) e em "unlock" de dedupe (quem ganha o lock deve sempre liberar).

## Testes
5 testes Vitest em `src/test/wizard-zombie-guard.test.ts` cobrem: cleanup, detecção stale, suppression default, runIfStale, reset de fase.
