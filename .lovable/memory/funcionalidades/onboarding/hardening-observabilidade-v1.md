---
name: Onboarding V2 · Hardening e Observabilidade v1
description: Envelope versionado com checksum FNV-1a, validação de shape, heartbeat multi-tab, detector de abandono e eventos canônicos de recovery/autosave.
type: feature
---

# Hardening + Observabilidade do Onboarding V2 (mai/2026)

## Mudanças cirúrgicas (zero schema, zero PHASE_ORDER, zero refactor)

- **Envelope v2** em `useOnboardingV2Draft`: campo `version: 2` + `checksum`
  FNV-1a (`src/lib/lightChecksum.ts`) calculado sobre `{profile, service, phase}`.
  Drafts v1 (sem version) descartados graciosamente. Helper
  `getLastReadDraftDiagnostics()` expõe motivo do descarte.
- **`draftEnvelope.ts`** (novo): `DRAFT_ENVELOPE_VERSION`, `computeDraftChecksum`,
  `validateDraftShape` (allow-list de fases conhecidas + tipos obrigatórios).
  Reusado no Shell ANTES de `dispatch HYDRATE` do recovery remoto.
- **`useAbandonmentTimer.ts`** (novo): 15min sem `pointerdown/keydown/touchstart/visibilitychange`
  emite `abandonment_suspected` 1× por fase por sessão (`setTimeout` único).
- **`crossTabSync.ts`**: ganhou `startTabHeartbeat()` (5s) + `detectConcurrentTab()`
  (<3s freshness). Emite `concurrent_tab_detected` no Shell sem bloquear escrita.
- **`useOnboardingV2RemoteDraft.ts`**: além de `remote_draft_failed`, agora
  emite `autosave_remote_ok` com `attempt` (1 ou 2 após retry).

## Eventos canônicos novos (todos via `trackOnboardingEvent`, `event:'next'|'error'`)
- `recovery_local_used` (com `refresh_detected:true`)
- `recovery_remote_used`
- `recovery_remote_discarded` (`reason: local_newer | shape_bad_profile | shape_bad_service | shape_bad_phase`)
- `recovery_corrupted` (`reason: version_mismatch | checksum_invalid | shape_invalid | parse_error`)
- `autosave_remote_ok` (`attempt`)
- `concurrent_tab_detected`
- `abandonment_suspected` (`idle_ms: 900000`)

`telemetryMeta.OnboardingEventMeta` ganhou `recovery_state`, `hydration_state`,
`checksum_ok`, `kind`.

## Testes
`src/test/onboarding-hardening-observability.test.ts` — 13 casos cobrindo
checksum, descarte por versão/shape/expiração, thin content, heartbeat multi-tab.

## Auditoria
`.lovable/audit/onboarding-persistence-2026-05.md` documenta pontos otimistas,
garantidos, parciais e ilusórios.

## NÃO mudou
- `PHASE_ORDER`, reducer público (`state.ts`), `flushRemoteDraft`, RLS, schema.
- UX do wizard, modal de recovery (apenas validação interna).
