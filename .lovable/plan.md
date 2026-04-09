# Plano PRO para Patrocinadores — Garantia de Entrega

## Resumo

Adicionar campos de campanha PRO na tabela `sponsors`, criar boost dinâmico no ranking engine, e incrementar `delivered_impressions` via tracking existente — tudo sem alterar hooks, componentes ou structure de slots.

## 1. Migração de banco (nova coluna na tabela sponsors)

Adicionar 5 colunas à tabela `sponsors`:

```sql
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS guaranteed_impressions integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivered_impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaign_start timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS campaign_end timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS needs_compensation boolean NOT NULL DEFAULT false;
```

Atualizar a função `track_sponsor_metric` para incrementar `delivered_impressions` quando `plan = 'pro'` e `event_type = 'impression'`:

```sql
CREATE OR REPLACE FUNCTION public.track_sponsor_metric(...)
-- Adicionar ao bloco IF _event_type = 'impression':
  UPDATE public.sponsors 
  SET delivered_impressions = delivered_impressions + 1 
  WHERE id = _sponsor_id AND plan = 'pro';
```

Criar função de compensação (chamada pelo cron `expire-sponsors` existente):

```sql
-- Marcar sponsors PRO com under-delivery quando campanha expira
UPDATE public.sponsors 
SET needs_compensation = true 
WHERE plan = 'pro' 
  AND campaign_end < NOW() 
  AND delivered_impressions < guaranteed_impressions 
  AND needs_compensation = false;
```

## 2. Atualizar interface `SponsorFull` (`src/hooks/useSponsors.ts`)

Adicionar os novos campos ao tipo:

```typescript
export interface SponsorFull {
  // ... campos existentes ...
  plan: string;                        // 'basic' | 'premium' | 'pro'
  guaranteed_impressions: number | null;
  delivered_impressions: number;
  campaign_start: string | null;
  campaign_end: string | null;
  needs_compensation: boolean;
}
```

Nenhuma outra alteração no hook.

## 3. Boost PRO no ranking engine (`src/lib/sponsorRanking.ts`)

Adicionar constante e função de boost:

```typescript
const MAX_PRO_BOOST = 3;
```

No `computeScore`, após calcular `score` base, adicionar:

```typescript
let proBoost = 0;
if (s.plan === 'pro' && s.guaranteed_impressions && s.guaranteed_impressions > 0) {
  const remaining = s.guaranteed_impressions - (s.delivered_impressions ?? 0);
  
  if (remaining > 0) {
    // Delivery boost: proporcional ao que falta entregar
    const deliveryBoost = Math.min(2, (remaining / s.guaranteed_impressions) * 2);
    
    // Pacing boost: se está atrasado na entrega
    let pacingBoost = 0;
    if (s.campaign_start && s.campaign_end) {
      const now = Date.now();
      const start = new Date(s.campaign_start).getTime();
      const end = new Date(s.campaign_end).getTime();
      const duration = end - start;
      if (duration > 0 && now >= start && now <= end) {
        const progress = (now - start) / duration;
        const expected = progress * s.guaranteed_impressions;
        if ((s.delivered_impressions ?? 0) < expected) {
          pacingBoost = 1;
        }
      }
    }
    
    proBoost = Math.min(MAX_PRO_BOOST, deliveryBoost + pacingBoost);
  }
}

const finalScore = score + proBoost;
```

Sem remover nenhuma lógica existente (tier, CTR, randomização, frequency cap).

## 4. Edge Function `expire-sponsors` — flag de compensação

Adicionar ao final da edge function existente a query de marcação de `needs_compensation` para sponsors PRO expirados com under-delivery.

## 5. Admin — visibilidade (sem novo painel)

Nenhuma alteração no admin agora. Os novos campos (`plan`, `guaranteed_impressions`, etc.) serão editáveis via formulário existente de sponsors quando o admin editar um registro. O campo `needs_compensation` aparecerá como indicador visual.

---

## Arquivos alterados


| Arquivo                                       | Mudança                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `supabase/migrations/` (nova)                 | Adicionar colunas + atualizar `track_sponsor_metric` |
| `src/hooks/useSponsors.ts`                    | Expandir interface `SponsorFull` (6 campos)          |
| `src/lib/sponsorRanking.ts`                   | Adicionar PRO boost no `computeScore`                |
| `supabase/functions/expire-sponsors/index.ts` | Adicionar marcação `needs_compensation`              |


## O que NÃO muda

- POSITION_CONFIG, hooks, componentes de renderização
- Lógica de tier weight, CTR, randomização, frequency cap, anti-dominance
- Schema de `sponsor_metrics`, tracking centralizado
- Layout/visual de qualquer componente

&nbsp;

&nbsp;

Refinar sistema PRO sem alterar estrutura existente:

&nbsp;

1. Reduzir agressividade do boost:

- deliveryBoost max = 1.5

- pacingBoost = 0.5

- MAX_PRO_BOOST = 2

&nbsp;

2. Garantir segurança matemática:

- Validar guaranteed_impressions > 0 antes de qualquer divisão

&nbsp;

3. Ajustar cálculo de progresso:

- Aplicar clamp entre 0 e 1:

  progress = Math.max(0, Math.min(1, (now - start) / duration))

&nbsp;

4. Validar tracking de impressões:

- Garantir que delivered_impressions não seja inflado por refresh

- Se necessário, adicionar deduplicação básica (session ou tempo mínimo)

&nbsp;

Não alterar:

- ranking base

- estrutura de slots

- hooks

- CTR logic