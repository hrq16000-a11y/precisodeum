# Auditoria Completa — Melhorias Pendentes

## Achados do Scan

O sistema está em bom estado. Os findings restantes são:

- **2x RLS "always true" em INSERT** — `pwa_install_events` e `sponsor_leads` (ambas intencionais: tracking público e formulário de lead aberto)
- **CNPJ exposto via API** — `ProviderProfile.tsx` faz `select('*')` nos providers, enviando CNPJ ao frontend mesmo sem exibir
- **Leaked password protection** — HIBP check desabilitado (configuração manual no painel Cloud)

## Plano de Execução (3 itens)

### 1. Ocultar CNPJ de queries públicas

O `ProviderProfile.tsx` e `useProviders.tsx` usam `select('*')` ou select amplo. O CNPJ viaja ao frontend desnecessariamente.

**Ação:** Substituir `select('*')` por select explícito (sem `cnpj`) nas queries públicas:

- `src/pages/ProviderProfile.tsx` — 3 queries que buscam providers
- `src/hooks/useProviders.tsx` — já usa select explícito sem cnpj (OK)

Para que RH possa ver o CNPJ, manter o select completo apenas quando o viewer é RH ou admin (verificar `profile_type` no contexto auth).

### 2. Restringir CNPJ via RLS (camada extra)

Criar uma **view** `public_providers_safe` que exclui `cnpj`, ou — mais simples — apenas ajustar as queries frontend (item 1). Como o CNPJ só é perigoso se chegar ao browser e as policies SELECT já restringem a `approved + !deleted`, a mitigação frontend é suficiente.

**Decisão:** Apenas ajustar queries frontend (sem nova view, sem alterar schema blindado).

### 3. UX — DashboardJobsPage refinamentos menores

- O backdrop do dropdown de cidades (`z-[5]`) agora fica **abaixo** do dropdown (`z-20`) — mas o backdrop `fixed inset-0` ainda intercepta cliques fora. Melhorar para usar `onBlur` no input + `mousedown` no dropdown, eliminando o backdrop completamente.

---

## Arquivos Modificados

- `src/pages/ProviderProfile.tsx` — substituir `select('*')` por select explícito sem `cnpj`; manter CNPJ visível apenas para RH/admin
- `src/pages/DashboardJobsPage.tsx` — eliminar backdrop e usar onBlur para fechar dropdown de cidades

## O que NÃO será alterado

- Schema de tabelas (blindado)
- `client.ts`, `types.ts`, `.env`
- GeoEngine, SIL, Governance Engine
- `useProviders.tsx` (já não expõe cnpj)
- Policies RLS existentes

Desejavel recursos ser Administravel e gerenciável pelo painel administrativo 