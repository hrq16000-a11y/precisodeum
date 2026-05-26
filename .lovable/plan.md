# Plano — Pós-Containment · Hardening + Observabilidade do Onboarding

Escopo cirúrgico, sem refactor, sem mudar `PHASE_ORDER`, sem alterar UX principal. Foco: tornar o onboarding **rastreável, recuperável e resiliente**.

---

## 1. Mapa dos pontos frágeis restantes (auditoria)

Identificados durante a leitura do containment já aplicado:

| # | Ponto | Risco atual | Severidade |
|---|---|---|---|
| F1 | `useOnboardingV2Draft` salva sem checksum/versão — corrupção silenciosa hidrata lixo | Médio | A endurecer |
| F2 | `flushRemoteDraft` tem lock por user, mas não detecta sessão paralela em outro device | Médio | A monitorar |
| F3 | `persistFirstServiceEarly` é otimista — sucesso de UI antes do confirm do INSERT em casos de rede degradada | Médio | A observar |
| F4 | Não existe evento `phase_exit`/`phase_duration` granular — abandono é invisível | Alto (cego) | A criar |
| F5 | Recovery local x remoto: existe race-guard de 5s, mas não há evento quando remoto é descartado | Baixo | A observar |
| F6 | `RemoteDraftRecoveryModal` aceita payload sem validar shape — hydration parcial inválida possível | Médio | A endurecer |
| F7 | Sem detecção de "refresh em fase X" — não dá pra correlacionar refresh ↔ perda | Médio | A criar |
| F8 | Multi-tab: `broadcastDraftChange` existe mas não bloqueia escrita concorrente entre abas em fases distintas | Médio | A endurecer leve |

Nenhum requer migração nem schema novo.

---

## 2. Telemetria estruturada (sem spam)

Estender `telemetry.ts` (que já tem `trackOnboardingEvent`) com um **dicionário canônico** de eventos. Reusa tabela `onboarding_events` existente — **zero schema change**.

Eventos novos (todos via `trackOnboardingEvent`, herdam `flow`/`intent` sticky):

```
phase_enter             → emitido 1x ao montar fase
phase_exit              → emitido com duration_ms ao trocar de fase
autosave_local_ok       → 1x a cada 10s (debounce) — não a cada keystroke
autosave_remote_ok      → após flushRemoteDraft resolver
autosave_remote_failed  → já existe, padronizar shape
recovery_local_used     → quando readOnboardingV2Draft hidrata
recovery_remote_used    → quando modal aceita remoto
recovery_remote_discarded → quando race-guard descarta remoto (Crítico #4)
first_service_persisted → INSERT inicial OK
first_service_reused    → reusedExistingService=true
first_service_update    → detailsPatch aplicado
validation_failed       → REASON_MAP disparou repair
refresh_detected        → mount com draft local válido e mesma fase
abandonment_suspected   → fase ativa há >15min sem interação (timer leve)
```

**Anti-spam:**
- `phase_enter` / `phase_exit` deduplicado por `(phase, sessionId)` em sessionStorage.
- `autosave_local_ok` com throttle de 10s.
- `abandonment_suspected` 1x por fase por sessão.

Meta canônica já existe em `telemetryMeta.ts` — só estender `OnboardingEventMeta` com `recovery_state`, `hydration_state`, `checksum_ok`.

---

## 3. Hardening do recovery (envelope versionado)

Em `useOnboardingV2Draft.ts`:

1. Envelope ganha `version: 2` e `checksum` (SHA-1 simples do JSON dos campos `profile+service+phase`, helper em `src/lib/lightChecksum.ts`).
2. `readOnboardingV2Draft` valida:
   - `version === 2` (caso contrário descarta — drafts v1 expiram naturalmente em 7d).
   - `checksum` confere → senão descarta + emite `recovery_corrupted`.
   - Shape mínimo (`profile` é objeto, `service` é objeto, `phase` é string conhecida).
3. `RemoteDraftRecoveryModal` recebe `validateRemoteDraftShape()` antes de hidratar.

Tudo fail-soft: corrupção = ignorar draft, nunca crash.

---

## 4. Multi-tab / multi-device safety

Sem lock pesado. Apenas:

1. **Heartbeat de aba ativa**: chave `onboarding_v2_active_tab` em localStorage com `{tabId, updatedAt}` atualizada a cada 5s. Reusa `crossTabSync.ts`.
2. Na hidratação, se outra aba escreveu há <3s e o `tabId` é diferente → não bloqueia, mas emite `concurrent_tab_detected` + (opcional) toast discreto "Esta conta está aberta em outra aba".
3. **Multi-device**: `flushRemoteDraft` já tem dedupe; adicionar campo `device_fingerprint` (reusa `src/lib/deviceFingerprint.ts` quando consent functional=true) na linha de `onboarding_v2_drafts` para correlação posterior — sem bloquear nada.

---

## 5. Auditoria de persistência (relatório gerado, não código)

Adicionar `.lovable/audit/onboarding-persistence-2026-05.md` listando:

- Pontos otimistas: `persistFirstServiceEarly` (UI segue antes de confirm em rede lenta).
- Pontos garantidos: `Phase4Final.handleFinish` (await + tracker).
- Pontos parciais: `detailsPatch` (não retorna erro ao usuário se UPDATE falha).
- Pontos ilusórios: nenhum após containment — confirmar.

Cada um marcado com: tem retry? tem telemetria? tem feedback ao usuário?

---

## 6. Detecção de abandono

`useAbandonmentTimer` (novo hook leve, ~40 linhas) em `phases/v2/`:
- Reset em qualquer `dispatch` ou interação no DOM raiz.
- Após 15min sem evento → emite `abandonment_suspected` 1x.
- Após 60min → marca draft local com `abandoned_at` para análise.

Sem UI, sem modal. Só telemetria.

---

## 7. Testes de resiliência (Vitest)

Novo arquivo `src/test/onboarding-hardening-observability.test.ts`:

1. Envelope v1 (sem version) é descartado.
2. Envelope com checksum inválido é descartado + emite `recovery_corrupted`.
3. Refresh com draft válido emite `refresh_detected` 1x.
4. `phase_exit` carrega `duration_ms > 0`.
5. Autosave local respeita throttle 10s (3 chamadas → 1 evento).
6. Race local-mais-novo descarta remoto E emite `recovery_remote_discarded`.
7. Shape inválido no remote modal não hidrata.
8. Multi-tab: 2ª aba detecta heartbeat e emite `concurrent_tab_detected`.
9. Abandono: 15min sem interação emite 1x.
10. `first_service_update` dispara só quando há `detailsPatch` real.
11. Validation `whatsapp_required` emite `validation_failed` com `error_code`.
12. Falha de `flushRemoteDraft` + retry sucesso emite `autosave_remote_ok` no final.

Meta: ≥12 testes verdes, sem flake.

---

## 8. Arquivos a alterar/criar

**Novos (5):**
- `src/lib/lightChecksum.ts` (~30 linhas)
- `src/components/onboarding/wizard/phases/v2/useAbandonmentTimer.ts` (~50 linhas)
- `src/components/onboarding/wizard/phases/v2/draftEnvelope.ts` — helpers de versão/checksum/shape (~80 linhas)
- `src/test/onboarding-hardening-observability.test.ts`
- `.lovable/audit/onboarding-persistence-2026-05.md`

**Editados (6):**
- `useOnboardingV2Draft.ts` — envelope v2 + checksum
- `useOnboardingV2RemoteDraft.ts` — emitir `autosave_remote_ok`
- `OnboardingV2Shell.tsx` — hook `useAbandonmentTimer`, eventos `phase_enter/exit/duration`, `refresh_detected`, `recovery_*_used/discarded`
- `RemoteDraftRecoveryModal.tsx` — `validateRemoteDraftShape`
- `crossTabSync.ts` — heartbeat de tabId
- `telemetryMeta.ts` — campos `recovery_state`, `hydration_state`, `checksum_ok`

**Memória (1):**
- `mem://funcionalidades/onboarding/hardening-observabilidade-v1`

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Spam de eventos inflar `onboarding_events` | Throttle/dedupe por sessionStorage |
| Heartbeat multi-tab causar loop de write | Intervalo 5s + comparação tabId |
| Validação de shape descartar drafts legítimos antigos | Versionamento (v1 expira em 7d sozinho) |
| Checksum quebrar hidratação em produção no rollout | Fallback: se checksum ausente, aceitar (graceful) |
| Hook de abandono custar bateria | `setTimeout` único, não `setInterval` |

---

## 10. Proibições reafirmadas

- Sem migração SQL.
- Sem mudar `PHASE_ORDER`.
- Sem mexer em wizard Bet/Smart/V1.
- Sem novo modal, sem nova rota.
- Sem alterar `state.ts` reducer (só leitura).
- Sem trocar `flushRemoteDraft` (só envelope/telemetria ao redor).

---

## 11. Critério de aceite

- Testes 12/12 verdes.
- Build sem warning novo.
- `onboarding_events` recebe os eventos novos em dev (validado por console grep).
- Refresh em fase 2 deixa rastro (`refresh_detected` + `recovery_local_used`).
- Draft v1 antigo no localStorage não crasha — é descartado silenciosamente.
- Audit `.md` entregue.

**Confirmar antes de executar:**  
1. Mantemos a tabela `onboarding_events` como destino único (sem nova tabela)?  
2. Posso usar SHA-1 puro em JS (sem libs) para o checksum leve?  
3. OK emitir toast discreto em `concurrent_tab_detected`, ou só telemetria silenciosa?
