

# Auditoria de Categorias e Correções

## Resultado da Auditoria

### Duplicatas encontradas

| Categoria | Slug A (tem providers) | Slug B (sem providers) | Ação |
|---|---|---|---|
| Técnico em Eletrônica | `tecnico-eletronica` (1 provider) | `tecnico-em-eletronica` (0) | Mover provider → slug B, deletar slug A |
| Técnico em Celular | `tecnico-celular` (1 provider) | `tecnico-em-celular` (0) | Mover provider → slug B, deletar slug A |

### Possíveis redundâncias (nomes similares, sem duplicata exata)
- "Instalador de Piso" / "Instalador de Pisos" — slugs diferentes, ambos válidos
- "Dedetização" / "Dedetizador" — contextos diferentes (serviço vs profissional)
- "Cozinheira" / "Cozinheiro" / "Cozinheira Doméstica" — variações válidas

### Categoria faltante
- **Eletrodomésticos — Conserto** não existe no banco

## Plano de Execução

### 1. Criar categoria "Eletrodomésticos — Conserto"
- INSERT na tabela `categories`: name = `Eletrodomésticos — Conserto`, slug = `eletrodomesticos-conserto`, icon = `🔌`
- Sem parent_id (categoria macro)

### 2. Corrigir duplicata "Técnico em Eletrônica"
- UPDATE provider com `category_id = 747d5370...` (tecnico-eletronica) → apontar para `4539f6e6...` (tecnico-em-eletronica)
- Soft-delete a entrada duplicada (`747d5370...`) com `deleted_at = now()`

### 3. Corrigir duplicata "Técnico em Celular"
- UPDATE provider com `category_id = cb18ed67...` (tecnico-celular) → apontar para `27dd5d75...` (tecnico-em-celular)
- Soft-delete a entrada duplicada (`cb18ed67...`) com `deleted_at = now()`

### Detalhes técnicos
- Todas operações via ferramenta de inserção/update (não migração, pois são dados)
- Nenhum arquivo de código precisa ser alterado
- Total: 1 INSERT + 2 UPDATEs de providers + 2 UPDATEs de categories (soft-delete)

