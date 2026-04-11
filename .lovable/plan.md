

# Reformular Barra Inferior Mobile

## Situação Atual (banco de dados)

- **Itens atuais**: Home(0), Buscar(1), Categorias(2), Perfil(3), WhatsApp(4)
- **hidden_paths**: `/admin`, `/login`, `/cadastro`, `/reset-password`, **`/dashboard`**, `/sponsor-panel`
- A barra **desaparece** quando o usuário está logado (dashboard está na lista de hidden_paths)

## Mudanças

### 1. Banco de dados (migration)

```sql
-- Remover /dashboard dos hidden_paths para a barra aparecer em toda navegação
UPDATE ui_bottom_nav_config 
SET hidden_paths = '["/admin", "/login", "/cadastro", "/reset-password", "/sponsor-panel"]'::jsonb
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Desativar WhatsApp
UPDATE ui_bottom_nav_items SET is_active = false 
WHERE id = 'be2f0238-1205-4cd5-bc16-43e867655282';

-- Reordenar: Buscar fica 1, Criar entra como 2, Categorias vai pra 3, Perfil vai pra 4
UPDATE ui_bottom_nav_items SET order_index = 3 WHERE id = '5e4ab0cd-aa50-4ab4-8494-21b713a205a2'; -- Categorias
UPDATE ui_bottom_nav_items SET order_index = 4 WHERE id = '2ddd95af-51ae-464f-8eab-ac32bb172339'; -- Perfil

-- Inserir botão "Criar" na posição central (2)
INSERT INTO ui_bottom_nav_items (config_id, label, icon, route_path, action_type, order_index, is_active, requires_auth, size, animation, active_color, background_color, border_radius)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Criar', 'Plus', '/dashboard/servicos', 'route', 2, true, true, 'large', 'scale', '#ffffff', '', '9999');
```

### 2. Componente MobileBottomNav.tsx

- **Fallback atualizado**: Ordem Início → Buscar → Criar → Categorias → Perfil (sem WhatsApp)
- **Remover `/dashboard` do hiddenPaths** do fallback
- **Botão "Criar" com destaque visual**: Ícone `Plus` dentro de um círculo com gradiente accent, elevado acima da barra (estilo FAB central), com animação de pulso sutil
- **Tratamento especial**: Itens com `size: 'large'` ou posição central recebem o estilo FAB automaticamente (funciona tanto no fallback quanto no dinâmico)

### 3. Resultado visual

```text
┌─────────────────────────────────────┐
│  Home   Buscar  [+]  Categ.  Perfil │
│   🏠      🔍    ⊕     ⊞      👤    │
└─────────────────────────────────────┘
                  ↑
          Botão elevado com
          gradiente accent
```

O botão "Criar" redireciona para `/dashboard/servicos` (requer login). Se o usuário não estiver logado, redireciona para `/login`.

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Reordenar itens, desativar WhatsApp, inserir "Criar", remover `/dashboard` dos hidden_paths |
| `src/components/MobileBottomNav.tsx` | Fallback atualizado + estilo FAB para botão central "Criar" |

