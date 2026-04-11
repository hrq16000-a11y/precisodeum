
Objetivo: restaurar a aparição dos profissionais sem mexer na regra correta de ocultar apenas os cadastros realmente incompletos.

1. Diagnóstico confirmado
- Hoje existem 164 profissionais aprovados/ativos no banco.
- A regra `incomplete_profile_hide_public=true` não explica “sumiu tudo”: ela esconderia só 14 perfis sem cidade/nome e deixaria 150 visíveis.
- O indício mais forte está na busca em linguagem natural. No replay, a consulta foi algo como:
  `Preciso de um instalador de ar-condicionado em São José dos Pinhais`
- Em `src/hooks/useProviders.tsx`, o filtro textual atual usa `terms.every(...)`.
- Em `src/lib/geoEngine.ts`, após extrair a cidade, os termos restantes ainda podem incluir palavras vazias como `preciso`, `um`, `de`, `em`.
- Resultado: a busca passa a exigir que o profissional contenha todos esses termos irrelevantes, o que derruba os resultados para zero.

2. Correção principal da busca
- Centralizar uma sanitização real da consulta antes do filtro textual:
  - remover palavras vazias e frases naturais (`preciso`, `quero`, `um`, `uma`, `de`, `do`, `da`, `em`, etc.)
  - normalizar hífen/acento (`ar-condicionado` = `ar condicionado`)
  - manter só tokens úteis de serviço
- Trocar a lógica rígida de `every` por relevância mínima:
  - 1 termo útil: exigir match desse termo
  - 2+ termos úteis: aceitar match parcial forte, não 100% obrigatório
- Incluir mais fontes de texto no match:
  - nome do serviço
  - descrição do serviço
  - categoria
  - nome do profissional/empresa
  - descrição do provider

3. Preservar a regra de visibilidade já existente
- Manter a regra pública atual:
  - ocultar apenas perfis realmente incompletos
  - não criar nenhum novo filtro de ocultação
- Garantir que home, listagens e busca usem o mesmo conjunto-base de profissionais públicos válidos.

4. Endurecer o carregamento da home
- Ajustar `useFeaturedProviders()` para não depender de tabela opcional inexistente.
- Hoje há chamada para `provider_boosts` retornando 404 no snapshot de rede; isso deve virar fallback silencioso, sem afetar a listagem de profissionais.

5. Verificação após a correção
- Testar exatamente a consulta do replay:
  `Preciso de um instalador de ar-condicionado em São José dos Pinhais`
- Confirmar:
  - profissionais voltam a aparecer na busca
  - home continua exibindo profissionais
  - os 14 incompletos continuam ocultos
  - os demais continuam visíveis como antes
  - selo DESTAQUE não interfere na visibilidade

Arquivos a ajustar
- `src/hooks/useProviders.tsx`
- `src/lib/searchIntelligence.ts`
- `src/lib/geoEngine.ts`
- possivelmente um helper novo para sanitização de termos de busca
- opcionalmente `src/components/SearchBar.tsx` apenas se eu decidir limpar a consulta já na entrada, mas a correção principal deve ficar no motor de busca

Detalhe técnico
```text
Consulta digitada
  ↓
GeoEngine extrai cidade
  ↓
Hoje sobra: "preciso um instalador de ar-condicionado em"
  ↓
useProviders exige match de TODOS os termos
  ↓
0 resultados

Após correção
  ↓
sobra algo como: "instalador ar condicionado"
  ↓
match por relevância + termos úteis
  ↓
profissionais reaparecem
```

Implementação proposta
1. Auditar e ajustar a extração dos `serviceTokens`
2. Criar sanitização de tokens úteis
3. Trocar `every(...)` por score de relevância
4. Agregar melhor texto de serviços no provider mapeado
5. Blindar fallback da query de `provider_boosts`
6. Validar home + busca + regra dos incompletos
