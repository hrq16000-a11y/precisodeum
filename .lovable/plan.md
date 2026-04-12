

# Reestruturação Global: Padronização de UI/UX e Tratamento de Dados

## Problema
Os screenshots mostram: datas cortadas/truncadas na página de vagas, texto transbordando em cards de profissionais, botões de WhatsApp cortados nas laterais, e falta de espaçamento consistente em mobile.

## Alterações

### 1. Utilitários centralizados de formatação (`src/lib/formatters.ts` - NOVO)
Criar arquivo com funções reutilizáveis:
- `formatDate(dateStr)` — usa `Intl.DateTimeFormat('pt-BR')` para datas legíveis
- `formatCurrency(value)` — usa `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- `formatDeadline(dateStr)` — formata prazo como "27 de mar. de 2026"

### 2. `src/index.css` — Regras globais adicionais
- Adicionar `white-space: normal` no `@layer base` para evitar truncamentos indesejados
- Adicionar regra `.info-row` (componente padronizado de ícone+texto com `display: flex; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap`)
- Garantir `padding-bottom` no body para não sobrepor MobileBottomNav

### 3. `src/pages/JobDetailPage.tsx` — Correção de datas e layout
- Substituir `job.deadline` raw por `formatDate(job.deadline)` 
- Substituir `new Date(job.created_at).toLocaleDateString('pt-BR')` por `formatDate(job.created_at)`
- Linha 150: adicionar `white-space: normal` no container de metadados para que datas não sejam cortadas
- Usar `formatCurrency` no campo de salário quando numérico
- Sidebar (linha 246): adicionar `flex-wrap` nos botões de compartilhamento para mobile

### 4. `src/components/ProviderCard.tsx` — Cards sem truncamento
- Linha 105: remover `truncate` do nome e substituir por `line-clamp-2 break-words`
- Linha 121: remover `truncate` do businessName, usar `line-clamp-1 break-words`
- Linha 89: trocar `p-5` por `p-[1.25rem]`
- Linha 180: adicionar `flex-wrap` nos botões de ação para que WhatsApp + Ver Perfil não sejam cortados em mobile
- Texto "Orçamento sem compromisso" (linha 206): garantir visibilidade com `white-space: normal`

### 5. `src/pages/CategoryPage.tsx` — Container e espaçamento
- Garantir que o container principal tenha `px-4` em mobile para conteúdo não encostar nas bordas

### 6. `src/pages/JobsPage.tsx` — Formatação de datas
- Substituir todas as referências a `timeAgo()` e datas raw por `formatDate()` do novo utilitário
- Cards de vagas: aplicar `flex-wrap` e `white-space: normal` nos metadados

### 7. `src/pages/SearchPage.tsx` — Filtros responsivos
- Container de filtros: garantir `flex-wrap` para não cortar em mobile

### 8. `src/components/MobileBottomNav.tsx` — Z-index e espaçamento
- Confirmar `z-50` no nav fixo
- Adicionar `pb-[4.5rem]` global via CSS para páginas com bottom nav não terem conteúdo sobreposto

### 9. Componente padrão `InfoRow` (`src/components/ui/InfoRow.tsx` - NOVO)
Componente reutilizável para blocos ícone + texto:
```tsx
const InfoRow = ({ icon: Icon, children }) => (
  <div className="flex items-start gap-[0.5rem] flex-wrap text-sm text-muted-foreground" style={{ whiteSpace: 'normal' }}>
    <Icon className="h-4 w-4 shrink-0 mt-0.5" />
    <span className="min-w-0 flex-1">{children}</span>
  </div>
);
```
Usar em `JobDetailPage` nos campos de localização, prazo, data de publicação, salário, horário.

## Detalhes Técnicos
- Todas as unidades de padding/margin em `rem` (já parcialmente implementado)
- `Intl.DateTimeFormat` e `Intl.NumberFormat` nativos do browser, sem dependência externa
- `line-clamp` via Tailwind (já disponível no projeto) substitui `truncate` para permitir 2+ linhas
- `flex-wrap: wrap` em todos os containers de botões e metadados para suporte a 320px

## Arquivos modificados/criados
| Arquivo | Ação |
|---------|------|
| `src/lib/formatters.ts` | **Criar** — funções de formatação centralizadas |
| `src/components/ui/InfoRow.tsx` | **Criar** — componente ícone+texto padronizado |
| `src/index.css` | Editar — regras globais |
| `src/pages/JobDetailPage.tsx` | Editar — datas, layout, InfoRow |
| `src/pages/JobsPage.tsx` | Editar — datas, flex-wrap |
| `src/components/ProviderCard.tsx` | Editar — truncamento, flex-wrap, rem |
| `src/pages/CategoryPage.tsx` | Editar — padding mobile |
| `src/pages/SearchPage.tsx` | Editar — filtros flex-wrap |

