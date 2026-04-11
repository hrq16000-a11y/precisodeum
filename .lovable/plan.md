## Plano: Upgrade Premium do Carrossel de Destaques

### Resumo

Transformar o carrossel de destaques em um componente de alta conversão com efeito glow nos ícones, barra de progresso animada, micro-interações, ordem aleatória, agendamento por datas e rastreamento de cliques (CTR).

---

### 1. Migration — Novos campos no banco

Adicionar `start_date`, `end_date` e `click_count` à tabela `highlights`:

```sql
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS start_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0;
```

---

### 2. Componente `HighlightsCarousel.tsx` — Redesign completo

**Dados:**

- Query filtra `active = true` e aplica lógica de data (`start_date`/`end_date`) no cliente
- Cards embaralhados aleatoriamente a cada render (Fisher-Yates shuffle)

**Visual Premium:**

- Ícone dentro de container arredondado (`rounded-xl p-2.5`) com fundo suave da `theme_color` (opacidade 10%) e `box-shadow` glow colorido
- Card com `hover:-translate-y-1` e transição suave
- Botão com seta animada (bounce horizontal infinito no hover do card)

**Barra de Progresso:**

- Substituir dots por pílulas de paginação onde a pílula ativa preenche progressivamente durante 5 segundos usando CSS `transition: width 5s linear`
- Reset ao trocar de slide

**UX:**

- Autoplay 5s com pause em `onMouseEnter` e touch
- Swipe touch mantido (já implementado)
- Loop infinito via módulo (já funciona)

**Tracking de cliques:**

- Ao clicar no botão CTA, incrementar `click_count` via `supabase.rpc` ou update direto
- Adicionar evento `click_highlight` ao sistema de tracking existente

---

### 3. Admin `AdminHighlightsPage.tsx` — Campos de agendamento e métricas

**Formulário:**

- Adicionar inputs de data/hora para `start_date` e `end_date` (type="datetime-local")

**Lista de destaques:**

- Exibir `click_count` ao lado de cada card com ícone de cursor
- Exibir datas de agendamento quando definidas

---

### Arquivos modificados

- Migration SQL (novos campos `start_date`, `end_date`, `click_count`)
- `src/components/home/HighlightsCarousel.tsx` (redesign completo)
- `src/pages/AdminHighlightsPage.tsx` (campos de agendamento + métricas)
- `src/lib/tracking.ts` (novo evento `click_highlight`)

Aqui estão os pontos altos que garantem que o resultado vai ficar com visual e funcionamento de alto nível:

Migration Precisa: A criação das colunas start_date, end_date e click_count direto no banco de dados (Supabase, pelo que vi) é a forma mais segura e profissional de gerenciar os dados.

Performance na Contagem: O uso de supabase.rpc para registrar os cliques é perfeito, pois salva a métrica rapidamente sem travar a navegação do usuário.

Animação Leve: A barra de progresso usando CSS nativo (transition: width 5s linear) é a melhor prática de programação para garantir que a animação rode lisa, sem gastar bateria ou processamento do celular de quem está acessando.