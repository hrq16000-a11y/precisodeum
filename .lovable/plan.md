

## Plan: Refinar Perfil do Profissional — Hierarquia, Dados e Consistência Visual

### 1. Criar função `capitalizeName` em `src/lib/normalize.ts`
Função que capitaliza nomes próprios respeitando preposições portuguesas (de, dos, da, e, etc.).
- `"luiz marcelo de sousa"` → `"Luiz Marcelo de Sousa"`
- Aplicar no display do nome em `ProviderProfile.tsx` (linha 492), `FeaturedProviders.tsx`, e breadcrumbs.

### 2. Refatorar o Header do Perfil (`ProviderProfile.tsx`)
**H1 limitado a 2 linhas** (linhas 929-933 e 996):
- O `pageSettings.headline` (que recebe texto gigante de descrição) deve ser limitado com `line-clamp-2` no H1.
- Se não houver headline customizado, usar `"{Nome} — {Categoria}"` como H1.
- Mover o texto longo da descrição/headline para a seção "Sobre o Profissional" (`renderAbout`), que já existe.

### 3. Aplicar `formatLocationString` na localização do perfil
Na linha 1029, a string de localização (`neighborhood, city - state`) não passa pela função de limpeza. Aplicar `formatLocationString` para corrigir espaços antes de vírgulas.

### 4. Remover tag "Usuário" (levelInfo)
Linhas 1008-1013: A tag `provider.levelInfo.name` (ex: "Usuário") é redundante em perfil profissional. Remover essa exibição, mantendo apenas `accTypeInfo` (Premium) e `DESTAQUE`.

### 5. Remover texto de experiência ao lado da localização
Linhas 1032-1037: Remover o bloco `{provider.years_experience} anos exp.` que aparece junto da localização, já que essa info está no StatMiniCard.

### 6. Padronizar cor do botão "Solicitar Orçamento" para `variant="accent"`
O botão já usa `variant="accent"` (linha 1117), que é o laranja da marca. O screenshot mostra azul provavelmente por `accentBg` override ou `pageSettings.accent_color`. Garantir que quando `accent_color` estiver vazio, o botão use a cor accent padrão (laranja) e não caia em fallback azul. Verificar se `variant="accent"` está corretamente definido no design system.

### Arquivos modificados:
- `src/lib/normalize.ts` — adicionar `capitalizeName()`
- `src/pages/ProviderProfile.tsx` — todas as 5 alterações acima
- `src/components/home/FeaturedProviders.tsx` — aplicar `capitalizeName` no `displayName`

