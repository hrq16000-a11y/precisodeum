# Correção definitiva do cadastro e pós-cadastro

## Diagnóstico confirmado

O código `be7e8939` foi localizado em `error_reports`. Ele corresponde ao erro fatal:

```text
cannot add `postgres_changes` callbacks for realtime:engagement-<user_id> after `subscribe()`
```

A falha ocorre em `/dashboard`, logo após o cadastro. O hook `useEngagementLevel` é montado por mais de um componente e cada instância reutiliza o mesmo nome de canal, adicionando um novo callback depois que o canal já foi assinado. O erro sobe até o `ErrorGuard` global e faz parecer que o Wizard falhou. Os relatórios dos últimos dias confirmam a mesma exceção para diferentes usuários e várias recorrências por sessão.

## Implementação

1. **Centralizar o canal de engajamento**
   - Migrar `useEngagementLevel` para o `realtimeRegistry` já usado pelo status de onboarding.
   - Manter exatamente uma assinatura `engagement-<user_id>`.
   - Distribuir cada evento recebido para todas as instâncias ativas do hook por listeners locais, sem chamar `.on()` novamente.
   - Remover listeners e liberar o canal por referência no cleanup, preservando StrictMode e remounts rápidos.

2. **Blindar os canais relacionados**
   - Revisar os consumidores simultâneos de engajamento no dashboard e onboarding para garantir nomes/configurações independentes.
   - Corrigir o vazamento confirmado em `Phase4Final`: hoje o cleanup de `provider-status:<id>` é retornado por uma função assíncrona interna e nunca chega ao React. Mover esse canal para o registro compartilhado, com liberação no cleanup real do efeito.
   - Confirmar que nenhum caminho compartilhado adiciona handlers depois de `.subscribe()`.
   - Manter o canal de toast separado, pois sua finalidade e callback são diferentes.

3. **Regressão automatizada**
   - Adicionar teste que proíbe criação direta do canal compartilhado em `useEngagementLevel` e exige `acquireChannel`/`releaseChannel`.
   - Cobrir montagem simultânea dos consumidores quando viável, validando uma assinatura e atualização de todas as instâncias.
   - Executar a suíte de regressões do incidente e testes do dashboard/onboarding afetados.

4. **Validação real do fluxo**
   - Entrar com sessão autenticada e percorrer o cadastro até a transição para `/dashboard`.
   - Verificar que o dashboard abre, nível/pontos carregam e não há exceção Realtime no console.
   - Recarregar e navegar rapidamente entre telas para exercitar remount e cleanup.
   - Confirmar que não surge novo `error_report` com a assinatura `after subscribe()` durante a validação.

5. **Entrega e acompanhamento**
   - Publicar a correção após os testes.
   - Usar `app_version`/`build_id` para separar ocorrências antigas das novas.
   - Acompanhar os relatórios por 24 horas e tratar qualquer assinatura fatal diferente como incidente separado, sem mascará-la como erro do Wizard.

## Critério de conclusão

- Cadastro conclui e chega ao dashboard sem tela “Algo deu errado”.
- Uma única assinatura do canal de engajamento por usuário, mesmo com múltiplos consumidores.
- Nenhuma exceção `cannot add postgres_changes callbacks ... after subscribe()` no fluxo validado.
- Testes direcionados e verificação autenticada no navegador aprovados.
