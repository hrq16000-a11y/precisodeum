

## Plano: Corrigir flickering do GeoBadge e manter temperatura sincronizada

### Problema
1. **Flickering**: O `GeoBadge` é definido como função interna do `Header`, recriando-se a cada render. Quando o geo hook atualiza (cache → edge → IP API), o badge pisca várias vezes. Além disso, o console mostra um warning de "Function components cannot be given refs" por causa disso.
2. **Temperatura desatualizada**: A temperatura é cacheada no `localStorage` e só é atualizada na primeira visita ou quando não existe. Não há mecanismo de refresh periódico.

### Solução

**Arquivo: `src/components/Header.tsx`**

1. **Extrair `GeoBadge` para fora do componente `Header`** — evita recriação a cada render e elimina o warning de refs.
2. **Adicionar animação suave de entrada** com CSS `transition` (opacity + transform) em vez de `animate-fade-in` que pisca a cada remontagem. Usar um wrapper com `transition-opacity duration-500` que faz fade-in apenas uma vez quando `geoCity` aparece.
3. **Passar `geoCity` e `geoTemp` como props** para o componente extraído.

**Arquivo: `src/hooks/useGeoCity.ts`**

4. **Adicionar refresh periódico da temperatura** — a cada 15 minutos, se já existem coordenadas, refazer `fetchTemp()` e atualizar o estado. Isso garante sincronização com a temperatura real sem sobrecarregar APIs.
5. **Evitar múltiplos setGeoState quando os dados não mudam** — comparar antes de chamar `setGeoState` para reduzir re-renders desnecessários.

**Arquivo: `supabase/functions/geo-city-weather/index.ts`**

6. **Retornar `state` (UF) na resposta** — o edge function já recebe a info do IP API mas não retorna `state`. Adicionar para evitar chamadas duplicadas ao fallback.

### Detalhes técnicos

```typescript
// GeoBadge extraído (Header.tsx)
const GeoBadge = ({ city, temp, className = '' }: { city: string | null; temp: number | null; className?: string }) => {
  if (!city) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-500 ease-out ${className}`}>
      <MapPin className="h-3 w-3 text-accent" />
      {city}
      {temp !== null && (
        <>
          <span className="mx-0.5 text-border">·</span>
          <Thermometer className="h-3 w-3 text-accent" />
          {Math.round(temp)}°C
        </>
      )}
    </span>
  );
};
```

```typescript
// Refresh periódico de temperatura (useGeoCity.ts)
const TEMP_REFRESH_MS = 15 * 60 * 1000; // 15 min
let tempInterval: ReturnType<typeof setInterval> | null = null;

// Iniciado quando coordenadas existem, atualiza temp silenciosamente
```

### Arquivos modificados
- `src/components/Header.tsx` — extrair GeoBadge, animação suave
- `src/hooks/useGeoCity.ts` — refresh de temperatura a cada 15 min, dedup de updates
- `supabase/functions/geo-city-weather/index.ts` — retornar `state` na resposta

