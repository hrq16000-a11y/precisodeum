

# Correções de Lógica Geo + Melhorias Visuais no Card e Banners

## 1. Correção Crítica: Contradição Geográfica (Cajuru dentro de Curitiba = "Outra região")

**Causa raiz:** Quando o usuário tem GPS ativo, `matchesGeoContext` usa APENAS distância (linha 873-878 do geoEngine). Se o raio é 5km e o provider em Cajuru/Curitiba está a 6km, ele é classificado como "outra região" — mesmo estando na mesma cidade e região metropolitana.

**Correção em `src/lib/geoEngine.ts`** (função `matchesGeoContext`):
- Após o check de raio por distância (PRIMARY), adicionar fallback de **mesma cidade**: se `pCityNorm === ctx.coreCity` ou o provider pertence à mesma região metropolitana, retornar `true` mesmo que esteja fora do raio em km
- Isso garante que um provider em Curitiba NUNCA seja "outra região" quando o usuário está em Curitiba

```text
Lógica atualizada:
1. Se dist <= raio → local ✓
2. Se dist > raio MAS mesma cidade ou metro → local ✓ (NOVO)
3. Se dist > raio E outra cidade → outra região
```

## 2. Banner de Aviso — Diferenciação Visual

**Arquivo:** `src/components/GeoFallbackBanner.tsx`

- Mudar de `border-accent/20 bg-accent/5` para `border-amber-200 bg-amber-50` (tom de alerta, não de resultado)
- Remover estilo de "card" — usar visual flat de aviso do sistema
- Adicionar botões de ação dentro do banner: "Ampliar raio para 50km" e "Buscar em outra cidade"
- Evitar o "beco sem saída" que o usuário reportou

## 3. Contraste das Tags (Acessibilidade)

**Arquivo:** `src/components/ProviderCard.tsx`

- Tag "Perfil Completo": mudar de `bg-accent/10 text-accent` para `bg-emerald-100 text-emerald-700 border border-emerald-200` — mais legível
- Tag "Outra região": mudar de `bg-muted text-muted-foreground` para `bg-amber-100 text-amber-700 border border-amber-200` — destaque de alerta
- Tag "Verificado": manter accent mas aumentar saturação para `bg-accent/15 text-accent font-bold`

## 4. Botão "Ver Perfil" com Ícone

**Arquivo:** `src/components/ProviderCard.tsx`

- Adicionar ícone `ArrowRight` (→) no botão "Ver Perfil" para equilibrar visualmente com o ícone do WhatsApp

## 5. Card de Patrocínio

Manter como está — o usuário aprovou o design atual.

## Detalhes Técnicos

| Arquivo | Alteração |
|---|---|
| `src/lib/geoEngine.ts` | Adicionar fallback same-city/metro no `matchesGeoContext` |
| `src/components/GeoFallbackBanner.tsx` | Visual de alerta + botões de ação (ampliar raio, buscar outra cidade) |
| `src/components/ProviderCard.tsx` | Contraste de tags melhorado + ícone no "Ver Perfil" |

Sem migração de banco. Sem nova edge function.

