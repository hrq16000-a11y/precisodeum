# Auditoria de persistência do Onboarding V2 — pós-containment (2026-05)

Estado após containment patch (Críticos #1–#5). Cada ponto classificado por
**otimista** (UI segue antes de confirm), **garantido** (await + tracker),
**parcial** (UPDATE sem feedback), **ilusória** (sucesso falso).

## Pontos otimistas
- `persistFirstServiceEarly` (OnboardingV2Shell): INSERT em `services` antes
  de avançar para `phase2_details`. Em rede muito lenta a UI segue antes do
  ACK. **Mitigação aplicada**: telemetria `first_service_persisted` /
  `first_service_reused` permite correlacionar perda futura.

## Pontos garantidos
- `Phase4Final.handleFinish`: tracker `createSyncTracker` + `await finalizeOnboarding`.
- `handleRemoteContinue`: agora valida shape antes de hidratar (F6).
- `setOnboardingProgress`: boundary única com merge defensivo (Fase 1.6.5).

## Pontos parciais
- `detailsPatch` em `persistFirstService`: UPDATE de cidades/horários não
  retorna erro visível ao usuário. **Mitigação proposta (futura)**: emitir
  `first_service_update` com `ok=false` quando o UPDATE falhar.

## Pontos ilusórios
- Nenhum identificado após containment.

## Observabilidade introduzida (esta auditoria)
- `recovery_local_used`, `recovery_remote_used`, `recovery_remote_discarded`
  (com `reason: local_newer | shape_*`).
- `recovery_corrupted` com `reason` (`version_mismatch | checksum_invalid | shape_invalid | parse_error`).
- `autosave_remote_ok` (com `attempt`) — antes só havia falha.
- `concurrent_tab_detected` (heartbeat).
- `abandonment_suspected` (15min sem interação, 1× por fase).
- `refresh_detected` (flag em `recovery_local_used`).

## Cenários ainda não blindados (próxima fase)
- Reconcile multi-device em tempo real (hoje é "última escrita vence").
- Lock duro de sessão entre abas (hoje só observabilidade).
- Telemetria de `detailsPatch` parcial.
