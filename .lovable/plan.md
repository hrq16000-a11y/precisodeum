# Plano: Mostrar Todos os Profissionais + Botão "Ver Mais"

## Diagnóstico


| Provider            | Nome            | Cidade   | Visível?                                 |
| ------------------- | --------------- | -------- | ---------------------------------------- |
| Alexsandro Romualdo | Sim             | Curitiba | Sim                                      |
| 9 outros            | Sim (full_name) | Vazio    | Não — filtro `isIncomplete` exige cidade |


**Causa**: A regra `isIncomplete = !displayName || !provCity` descarta os 9 profissionais que têm nome mas não preencheram cidade. O filtro `hideIncomplete` remove todos eles.

**Segundo problema**: Quando há pelo menos 1 resultado local, o `CategoryPage` mostra APENAS os locais — sem opção de ver o restante.

## Correção em 2 partes

### 1. Relaxar regra de incompleto: cidade deixa de ser obrigatória

Em `src/hooks/useProviders.tsx`, linha ~249:

```
// Antes
const isIncomplete = !displayName || !provCity;

// Depois
const isIncomplete = !displayName;
```

Profissionais sem cidade ficam visíveis mas aparecem abaixo dos que têm localização (já ocorre naturalmente pelo geo ranking).

### 2. Botão "Ver profissionais de outras localidades" na CategoryPage

Em `src/pages/CategoryPage.tsx`, quando há resultados locais E existem mais profissionais fora da região:

- Mostrar os locais primeiro
- Exibir botão "Ver mais de outras localidades (N)"
- Ao clicar, expandir para mostrar todos
- Atualizar o contador no hero para refletir o total visível

## Arquivos


| Arquivo                      | Alteração                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `src/hooks/useProviders.tsx` | Remover `!provCity` da regra `isIncomplete`                                         |
| `src/pages/CategoryPage.tsx` | Adicionar estado `showAllLocations` + botão de expansão + separar locais vs. outros |


## Resultado

- Todos os 10 profissionais de "Serviços Técnicos" aparecem
- Profissionais locais aparecem primeiro
- Botão para expandir e ver profissionais de outras regiões (ou sem cidade)
- Nenhum profissional com nome é escondido por falta de cidade

Permitir gestão disso pelo painel administrativo 