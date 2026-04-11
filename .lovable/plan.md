# Adicionar "Vagas" ao Menu Mobile

## Situação Atual

- **Header desktop**: ✅ Já tem "Vagas" no `menu_items` (posição 4, ativo)
- **Menu mobile**: ❌ Falta o link "Vagas" — tem apenas Início, Buscar, Categorias, Perfil

## Ação

Inserir um registro na tabela `menu_items` para a localização `mobile` com o link de Vagas:

```sql
INSERT INTO menu_items (label, url, icon, menu_location, display_order, active, open_in_new_tab)
VALUES ('Vagas', '/vagas', 'Megaphone', 'mobile', 3, true, false);
```

Isso reordena os itens mobile: Início (0) → Buscar (1) → Categorias (2) → **Vagas (3)** → Perfil (4).

Também atualizar o `display_order` do item "Perfil" de 3 para 4:

```sql
UPDATE menu_items SET display_order = 4 WHERE id = 'ba1f4f00-5227-489e-8e1f-e1354c0c56eb';
```

## Resultado

O link "Vagas" aparecerá tanto no menu desktop quanto no mobile, 100% gerenciável pelo admin em `/admin/menus`. O admin pode reordenar, desativar ou remover a qualquer momento.

## Arquivos Modificados

Nenhum arquivo de código — apenas inserts/updates na tabela `menu_items` via migration.

&nbsp;

Tudo deve ser e estar sincronizado e gerenciável pelo painel administrarivo correspondente. 

&nbsp;