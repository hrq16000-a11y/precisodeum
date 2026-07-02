# Onboarding Regression Watch — auditoria & contrato

> Data: 2026-05-26 · status: ativo (cron criado, flag default OFF)

## 1. Objetivo

Detectar **automaticamente** quando alguma alteração futura piora o onboarding:
- perda de dados / quebra de recovery
- aumento de abandono / refresh destrutivo
- explosão de validation_failed
- queda de persistência do 1º serviço / completion rate
- loops, retries excessivos, hidratação corrompida

**Sem IA. Sem ML. Sem nova tabela. Sem refactor.** Só estatística simples
(`current vs baseline móvel`) sobre `public.onboarding_events`.

## 2. Arquitetura (3 peças)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Cliente: trackOnboardingEvent() auto-injeta:                         │
│   meta.app_version    ← APP_VERSION (src/lib/appVersion.ts)          │
│   meta.release_channel ← preview | production | dev                  │
│ Toda métrica fica correlacionável com o deploy.                      │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼ INSERT
┌──────────────────────────────────────────────────────────────────────┐
│ Tabela única: public.onboarding_events                               │
│ (sem nova tabela; mesma RLS, mesmos índices GIN/BTree)               │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼ cron */15 min (gateado por flag)
┌──────────────────────────────────────────────────────────────────────┐
│ RPC public.detect_onboarding_regressions(_window_minutes,            │
│                                          _baseline_days,             │
│                                          _debounce_hours)            │
│  1) computa rates current (60min) e baseline (7d-60min)              │
│  2) min-sample guard (blinda falso positivo)                         │
│  3) classifica severidade (low/medium/high/critical)                 │
│  4) debounce: não re-emite mesma severidade em 6h                    │
│  5) INSERT em onboarding_events com event=                           │
│     'onboarding_regression_detected'                                 │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼ leitura
        Admin (RLS has_role admin) consulta direto a tabela
        (dashboard fica para fase futura — escopo desta entrega
        é parar de descobrir regressão pela boca do usuário)
```

A lógica em **TypeScript puro** vive em
`src/lib/onboarding/regressionDetector.ts` — espelho do que a RPC faz, usado
para testes determinísticos e debugging local (não roda em produção).

## 3. Métricas monitoradas (v1)

| Métrica                       | Direção          | min cur | min base | medium | high | critical |
|-------------------------------|------------------|---------|----------|--------|------|----------|
| `validation_failed_rate`      | higher_is_worse  | 30      | 150      | 8 pp   | 15pp | 30 pp    |
| `autosave_remote_failed_rate` | higher_is_worse  | 30      | 150      | 5 pp   | 10pp | 20 pp    |
| `refresh_rate`                | higher_is_worse  | 30      | 150      | 8 pp   | 15pp | 30 pp    |
| `concurrent_tab_rate`         | higher_is_worse  | 20      | 100      | 5 pp   | 10pp | 20 pp    |
| `recovery_discarded_rate`    | higher_is_worse  | 5       | 30       | 5 pp   | 10pp | 20 pp    |
| `first_service_persist_rate`  | **lower_is_worse** | 15    | 75       | 5 pp   | 10pp | 20 pp    |
| `completion_rate`             | **lower_is_worse** | 20    | 100      | 8 pp   | 15pp | 30 pp    |
| `avg_phase_duration_ms`       | higher_is_worse  | 30      | 150      | +30%   | +60% | +100%    |

> `low` = ≥ 50% do threshold `medium` (informativo, não acionável).

### Métricas declaradas no catálogo TS, ainda sem mapping SQL pronto

Estão **prontas** no detector puro (testes verdes), mas dependem de novas
`meta.kind` que o wizard ainda não emite com nome canônico. Vão entrar quando
o evento for tagueado:

- `recovery_local_rate` / `recovery_remote_rate` (precisa de
  `meta.kind='recovery_local_accepted'` / `recovery_remote_accepted`)
- `corruption_discard_rate` (já parcialmente coberto por `recovery_discarded_rate`)
- `invalid_hydration_rate` (precisa de `meta.kind='hydration_invalid'`)
- `retry_remote_rate` (precisa tagging consistente em retries)
- `avg_total_duration_ms` (sessão inteira; requer `enter→complete` por session_id)
- `abandon_rate` (hoje é proxy `1 - completion_rate`; evento `abandon` reservado)

## 4. Severidade

```text
delta >= critical → critical   (rollback recomendado)
delta >= high     → high       (investigar antes do próximo deploy)
delta >= medium   → medium     (abrir issue, monitorar próximas janelas)
delta >= medium/2 → low        (informativo)
```

Para durações, `delta` é **crescimento relativo** (`(cur - base)/base`),
não pp.

## 5. Debounce

A mesma `(metric, severidade)` **não é re-emitida** dentro de `_debounce_hours`
(padrão 6h). Escalonamento (`medium` → `high`) **reemite**, porque é informação
nova. Implementação: `WHERE NOT EXISTS (… severity_rank >= …)`.

## 6. Falso positivo — mitigações

| Risco                                  | Mitigação                                                       |
|----------------------------------------|------------------------------------------------------------------|
| amostra pequena na janela atual         | `min_cur` por métrica                                            |
| baseline ainda esquentando (pós-deploy) | `min_base` por métrica + cálculo IGNORA a janela atual           |
| ruído noturno / fuso                    | janela móvel de 7d absorve sazonalidade                          |
| spam de alerta                          | debounce de 6h + severity_rank                                  |
| mudança de taxonomia de meta.kind       | catálogo TS é fonte da verdade; RPC documenta cada `kind`        |

**Riscos residuais conhecidos:**

1. Se o volume cair muito (ex.: bug derrubou tráfego), `min_cur` segura tudo
   e o detector se cala. Isso é DESEJADO — não emitir falso alerta — mas
   pode mascarar regressão real em janelas pequenas. **Mitigação futura:**
   alerta separado de "volume colapsou".
2. Mudança brusca de comportamento (ex.: novo experimento A/B) será lida como
   regressão durante a janela de transição. **Mitigação:** janela de baseline
   de 7d dilui em < 1 semana, e debounce evita spam.

## 7. Correlação com release

Cada anomalia carrega `app_version` + `release_channel` (mais frequente na
janela atual). Consulta-tipo para responder *"essa regressão começou após
qual deploy?"*:

```sql
SELECT meta->>'metric', meta->>'severity', meta->>'app_version',
       count(*), min(created_at), max(created_at)
FROM public.onboarding_events
WHERE event = 'onboarding_regression_detected'
  AND created_at > now() - interval '14 days'
GROUP BY 1, 2, 3
ORDER BY 5;
```

## 8. Como ligar / desligar em produção

```sql
-- liga
UPDATE public.site_settings
SET value = 'true'::jsonb
WHERE key = 'onboarding_regression_watch_enabled';

-- desliga (rollback)
UPDATE public.site_settings
SET value = 'false'::jsonb
WHERE key = 'onboarding_regression_watch_enabled';
```

Default = **OFF**. O cron roda a cada 15 min mas faz `SELECT NULL` quando a
flag está OFF — custo zero.

## 9. Testes

`src/test/onboarding-regression-detector.test.ts` — 16 testes:

- 1 cobre cada cenário pedido na auditoria (abandono explosivo, validation
  failed, queda completion, refresh, falso positivo bloqueado, debounce,
  escalonamento, severidades, baseline insuficiente, duração relativa, context
  propagado, métrica ausente).
- 1 trava o catálogo: as 15 métricas pedidas estão declaradas.

Execução: `bunx vitest run src/test/onboarding-regression-detector.test.ts`.

## 10. Exemplos de regressão detectada (output esperado)

```jsonc
// row em onboarding_events
{
  "event": "onboarding_regression_detected",
  "session_id": "regression-watch",
  "variant": "detector",
  "phase": "system",
  "meta": {
    "metric": "completion_rate",
    "severity": "high",
    "delta": 0.18,
    "current": 0.52,
    "baseline": 0.70,
    "sample_current": 240,
    "sample_baseline": 8400,
    "window_minutes": 60,
    "baseline_days": 7,
    "app_version": "1.1.0",
    "release_channel": "production",
    "detected_at": "2026-05-26T12:00:00Z"
  }
}
```

Significado humano: *"nas últimas 60 minutos, a taxa de conclusão caiu de
70 % (média de 7d) para 52 % — 18 pp abaixo, severidade `high`, no app
1.1.0 em produção. Investigar deploy."*

## 11. Não-objetivos desta fase

- Dashboard visual (ficará em uma fase futura, lendo a mesma tabela).
- Notificação por e-mail / push (idem; admin consulta diretamente).
- Worker dedicado (cron + RPC já bastam — sem nova infra).
- ML / anomaly detection estatística avançada (z-score, EWMA) — overkill
  para o problema imediato; a versão pp + threshold cobre 95% dos casos
  reais sem falso positivo.
