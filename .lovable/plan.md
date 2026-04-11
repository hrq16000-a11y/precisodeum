

# Histórico de Sincronizações na Página de Mídia

## Abordagem

Usar a tabela `audit_log` existente para registrar cada sincronização (já temos `logAuditAction`), e adicionar uma seção colapsável na página de mídia mostrando o histórico.

## Implementação

### 1. Registrar sincronizações no audit_log
Alterar `syncStorage()` em `AdminMediaPage.tsx` para chamar `logAuditAction` após cada sincronização bem-sucedida, com action `media_uploaded`, resource_type `storage_sync`, e details contendo `{ inserted, scanned_buckets, existing_tracked, new_files_found }`.

### 2. Adicionar seção de histórico na UI
Após os stats cards, adicionar um card colapsável "Histórico de Sincronizações" que:
- Busca os últimos 20 registros de `audit_log` onde `resource_type = 'storage_sync'`
- Mostra data/hora formatada, quantidade de arquivos sincronizados, e buckets escaneados
- Inclui botão para expandir/recolher

## Arquivo modificado

| Arquivo | Alteração |
|---|---|
| `src/pages/AdminMediaPage.tsx` | Adicionar log de auditoria no sync + seção de histórico com fetch do audit_log |

Sem mudanças de banco de dados — reutiliza a tabela `audit_log` existente.

