

# Ações em Massa e Aprovação Automática Sincronizada no Painel Admin

## Problema
O painel já tem seleção individual + bulk actions, mas falta um botão rápido "Aprovar Todos Pendentes" sem precisar selecionar um a um. O toggle de aprovação automática está nas configurações gerais mas não é visível/acessível diretamente na página de prestadores.

## Solução

### 1. Botão "Aprovar Todos Pendentes" no header da página
Adicionar botão no topo (ao lado de "Exportar CSV") que aprova todos os prestadores pendentes com cidade/estado preenchidos de uma vez, com confirmação via AlertDialog.

### 2. Toggle de Aprovação Automática inline
Exibir o toggle `auto_approve_providers` diretamente na página de prestadores (acima dos cards), sincronizado com `site_settings`. O admin pode ligar/desligar sem ir à página de configurações.

### 3. Botão "Rejeitar Todos Pendentes"
Adicionar também opção de rejeitar todos pendentes em massa.

## Alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/pages/AdminProvidersPage.tsx` | Adicionar botões "Aprovar Todos" e "Rejeitar Todos" no header; toggle inline de auto-approve sincronizado com `site_settings`; funções `approveAllPending` e `rejectAllPending` com confirmação |

## Lógica

```typescript
// Aprovar todos pendentes com cidade/estado
const approveAllPending = async () => {
  const pendingIds = allProviders
    .filter(p => p.status === 'pending' && p.city && p.state)
    .map(p => p.id);
  
  await supabase.from('providers')
    .update({ status: 'approved' })
    .in('id', pendingIds);
  
  await logAuditAction({ action: 'bulk_active', resource_type: 'provider', details: { count: pendingIds.length } });
  fetchProviders();
};

// Toggle auto-approve sincronizado
const [autoApprove, setAutoApprove] = useState(false);
// Buscar valor atual de site_settings ao carregar
// Ao mudar toggle → update site_settings + toast
```

## Resultado
- "Aprovar Todos" aprova instantaneamente todos os pendentes qualificados (com cidade/estado)
- Toggle de aprovação automática visível e funcional direto na página de prestadores
- Todas as ações registradas no audit_log
- Interface 100% sincronizada com o banco

