

# Contador de Profissionais Online — Baseado em Presença Real

## Problema
O componente `ActiveProvidersCounter` conta **todos** os profissionais aprovados no banco, não os que estão realmente online. Exibe "58 profissionais prontos" quando na verdade nenhum pode estar conectado.

## Solução
Substituir a query ao banco pelo sistema de presença real (`useOnlineProviders`), cruzando os user_ids online com os providers da região do usuário.

### Alterações

**1. `src/hooks/useOnlinePresence.ts`** — Incluir `city` no track de presença
- Na função `usePresenceTracker`, aceitar um segundo parâmetro opcional `meta?: { city?: string }`
- Enviar `{ user_id, city }` no `ch.track()`
- Atualizar `syncPresenceState` para armazenar um Map `<userId, { city }>` em vez de um Set
- Exportar novo hook `useOnlineProvidersByCity(city)` que filtra o Map pela cidade

**2. `src/hooks/useAuth.tsx`** — Passar cidade do perfil ao tracker
- Buscar a cidade do provider do usuário logado (já disponível no perfil/provider)
- Passar `{ city }` como meta para `usePresenceTracker`

**3. `src/components/home/ActiveProvidersCounter.tsx`** — Usar presença real
- Trocar a query ao Supabase por `useOnlineProvidersByCity(geoCity)`
- Contar apenas providers realmente online na cidade/região
- Se nenhum online → `return null` (não exibe nada)
- Texto: "X profissional(is) online agora em {cidade}"

### Dados enviados no Presence

```typescript
// Antes
ch.track({ user_id: userId });

// Depois  
ch.track({ user_id: userId, city: meta?.city });
```

### Lógica de filtragem

```typescript
// Novo Map interno
let onlineUsersMap = new Map<string, { city?: string }>();

// Hook filtrado por cidade
export function useOnlineCountByCity(city: string | null): number {
  const map = useOnlineUsersMap();
  return useMemo(() => {
    if (!city) return map.size; // total online
    let count = 0;
    map.forEach(v => {
      if (v.city?.toLowerCase() === city.toLowerCase()) count++;
    });
    return count;
  }, [map, city]);
}
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useOnlinePresence.ts` | Track com `city`, Map em vez de Set, novo hook `useOnlineCountByCity` |
| `src/hooks/useAuth.tsx` | Buscar cidade do provider e passar ao tracker |
| `src/components/home/ActiveProvidersCounter.tsx` | Usar presença real; ocultar se 0 online |

### Resultado
- Contador mostra apenas profissionais **realmente conectados** na plataforma
- Se ninguém está online na região, o componente não aparece
- Mantém o badge pulsante verde para indicar presença real

