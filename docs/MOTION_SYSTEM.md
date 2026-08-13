# Sistema de Motion · Preciso de Um

Camada única de animação, skeletons e estados de carregamento. CSS puro (sem custo de bundle JS), durações curtas e zero layout shift.

## Princípios

1. **Nunca tela em branco** — toda tela assíncrona passa por `AsyncBoundary` com skeleton obrigatório.
2. **Nunca CLS** — deslocamento máximo de 8px; imagens reservam espaço via `aspect`.
3. **Rápido é invisível** — skeleton de rota só aparece após 220ms; navegação instantânea não pisca.
4. **Acessível** — `prefers-reduced-motion` desliga todas as animações; skeletons têm `role="status"`.
5. **Permissão negada é estado, não erro genérico** — 42501/RLS mostram mensagem própria e nunca vazam dados.

## Tokens (`src/index.css`)

| Token | Valor | Uso |
| --- | --- | --- |
| `--motion-fast` | 140ms | saída, micro-hover |
| `--motion-base` | 220ms | entrada de bloco/rota |
| `--motion-slow` | 320ms | fade/blur-up de imagem |
| `--motion-ease-out` | `cubic-bezier(.22,1,.36,1)` | entradas |
| `--motion-ease-in` | `cubic-bezier(.55,0,1,.45)` | saídas |

Classes: `.motion-enter`, `.motion-enter-fade`, `.motion-enter-scale`, `.motion-exit`, `.motion-stagger`, `.motion-indeterminate`, `.skeleton-shimmer`, `.motion-img`.

## Componentes (`src/components/motion`)

```tsx
import {
  AsyncBoundary, LazyImage, ProgressIndicator, Reveal,
  SkeletonCardGrid, SkeletonList, SkeletonTable, SkeletonForm, SkeletonText,
} from '@/components/motion';
```

- **`AsyncBoundary`** — `loading | error | empty | children`. Detecta 42501/RLS automaticamente.
- **`LazyImage`** — `loading="lazy"` + shimmer + fade/blur-up. Use `priority` só na imagem LCP e `aspect` sempre.
- **`Reveal`** — entrada por IntersectionObserver, dispara uma vez. Para grids, prefira `className="motion-stagger"`.
- **`ProgressIndicator`** — barra determinada (`value`) ou indeterminada. `fixed` para o topo da página.
- **Skeletons** — formas prontas: texto, card, grid, lista, tabela, formulário.

## Padrão de adoção em uma tela

```tsx
<AsyncBoundary
  loading={isLoading}
  error={error}
  empty={!data?.length}
  skeleton={<SkeletonCardGrid count={6} />}
  emptyTitle="Nenhum profissional nesta cidade ainda"
  onRetry={refetch}
>
  <div className="motion-stagger grid gap-4">
    {data.map((p) => <ProviderCard key={p.id} provider={p} />)}
  </div>
</AsyncBoundary>
```

## Testes

`src/test/motion-system.test.tsx` (11 testes) trava: existência dos tokens CSS, bloco `prefers-reduced-motion`, shimmer no `Skeleton`, os quatro estados do `AsyncBoundary`, atributos de lazy/priority do `LazyImage`, modos do `ProgressIndicator` e o fallback do `Reveal` sem IntersectionObserver.
