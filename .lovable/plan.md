

## Aplicar parametrizações do cadastro na página /dashboard/perfil

### Problema
A página `DashboardProfilePage.tsx` usa campos de texto livre para cidade/estado e um `<select>` simples para categoria, sem as melhorias aplicadas ao cadastro: seletor inteligente de cidade (IBGE + GPS), categoria hierárquica com "Outro", CNPJ, validações robustas e lat/lon.

### Mudanças no arquivo `src/pages/DashboardProfilePage.tsx`

**1. Seletor inteligente de cidade (igual ao cadastro)**
- Importar `fetchAllMunicipalities`, `geocodeCity`, `reverseGeocode`, `normalize` de `geoUtils`
- Substituir inputs de cidade/estado por busca com autocomplete + botão "Usar minha localização"
- Estado fica readonly (auto-preenchido pela seleção)
- Adicionar `latitude`, `longitude` ao form state (pré-populados do provider existente)

**2. Categoria hierárquica com "Outro"**
- Substituir `<select>` por busca com árvore macro/sub (mesma lógica do cadastro)
- Adicionar `category_custom` ao form state (pré-populado do provider)
- Chip visual para categoria selecionada com botão de remoção

**3. Campo CNPJ opcional**
- Adicionar `cnpj` ao form state (pré-populado do provider)
- Input com máscara `XX.XXX.XXX/XXXX-XX`
- Validação: se preenchido, deve ter 14 dígitos

**4. Validações robustas no handleSave**
- Telefone: mínimo 10 dígitos
- Categoria: `category_id` OU `category_custom` obrigatório (para providers)
- Cidade/estado: devem vir de seleção válida (limpar se input mudar)
- CNPJ: exatamente 14 dígitos se preenchido
- Lat/lon: fallback `geocodeCity` se ausente mas cidade selecionada
- Spinner + disable botão durante save

**5. Salvar campos extras no submit**
- Incluir `category_custom`, `cnpj` (sanitizado), `latitude`, `longitude` nos updates/inserts do provider

**6. Pré-popular campos do provider existente**
- `category_custom`, `cnpj`, `latitude`, `longitude` no useEffect que carrega dados

### Arquivos afetados
| Arquivo | Ação |
|---|---|
| `src/pages/DashboardProfilePage.tsx` | Editar (seletor cidade, categoria, CNPJ, validações) |

Nenhuma migração necessária — `category_custom` e `cnpj` já existem na tabela `providers`.

