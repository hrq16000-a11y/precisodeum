

# Melhorar Banner de Fallback Geográfico

## Problema
O banner atual mostra uma mensagem genérica e negativa: "Não encontramos resultados em São José dos Pinhais. Exibindo X resultado(s) em todo o Brasil. Esses profissionais são de outras regiões e podem não atender sua localidade." — tom alarmista com ícone de warning amarelo.

## Solução
Trocar para um tom positivo e informativo, focando nas cidades próximas encontradas:

**Novo texto:**
- Título: `Não encontramos profissionais em {cidade}, mas encontramos em cidades próximas!`
- Se tem `nearestDistanceKm`: `O mais próximo está a apenas {X} km, em {cidadeMaisPróxima}. Gostaria de ver?`
- Se não tem distância: `Encontramos {N} profissional(is) em cidades vizinhas. Gostaria de ver?`

**Novo visual:**
- Trocar `AlertTriangle` amarelo por `MapPin` azul/primary
- Fundo: `bg-blue-50 border-blue-200` em vez de amber (tom informativo, não alarmante)
- Botão CTA: "Ver profissionais próximos" com estilo primary

## Props adicionais
Adicionar prop opcional `nearestCity?: string` para exibir o nome da cidade mais próxima quando disponível.

## Alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/components/GeoFallbackBanner.tsx` | Novo texto positivo, ícone MapPin azul, nova prop `nearestCity` |
| `src/pages/CategoryPage.tsx` | Passar `nearestCity` ao GeoFallbackBanner (extrair da lista de nearby/outOfState) |
| `src/pages/SearchPage.tsx` | Idem — passar `nearestCity` |

