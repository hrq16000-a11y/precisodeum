

# Plano: Limpeza Diária Automática de Cache (Web + PWA)

## Problema Atual
O sistema só limpa cache quando detecta um novo deploy (`__BUILD_TIMESTAMP__`). Se não houver deploy por dias, dados obsoletos podem ficar no cache do browser e do Service Worker.

## Solução

### 1. Limpeza diária no frontend (`src/main.tsx`)
Adicionar verificação baseada em data. Ao carregar a app, compara a data atual com a última limpeza salva em `localStorage`. Se passou 24h ou mais, purga todos os caches (Cache API + react-query).

```text
Fluxo:
  App inicia
  → Verifica localStorage('cache-last-purge')
  → Se > 24h atrás (ou inexistente):
      → caches.keys() → delete all
      → localStorage.clear() de dados temporários
      → Salva nova timestamp
  → Continua normalmente
```

### 2. Limpeza diária no Service Worker (`src/sw.ts`)
Adicionar listener de `message` para receber comando `PURGE_CACHES` do frontend. Também implementar auto-purge periódica: a cada fetch, verifica se já passou 24h desde a última limpeza interna do SW.

### 3. Limpeza do React Query stale data
No `App.tsx`, adicionar rotina que invalida todas as queries do `QueryClient` quando a limpeza diária é acionada, garantindo dados frescos do banco.

## Arquivos a Editar

| Arquivo | Mudança |
|---|---|
| `src/main.tsx` | Adicionar lógica de purge diário (24h) + enviar mensagem ao SW |
| `src/sw.ts` | Adicionar listener `PURGE_CACHES` + auto-purge periódica no SW |

## Detalhes Técnicos

- **Chave localStorage**: `cache-last-purge` (timestamp em ms)
- **Intervalo**: 24 horas (86400000 ms)
- **O que é limpo**: Cache API (api-cache, fonts-cache, images-cache), dados stale do localStorage
- **Não limpa**: credenciais de auth, preferências do usuário, build version key
- **SW**: responde a mensagem `{type: 'PURGE_CACHES'}` e também verifica internamente via IndexedDB/cache timestamp

