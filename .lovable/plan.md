# Manter exatamente a implementação atual baseada em position como fonte única de verdade, sem alterar estrutura, nomes ou funcionamento existente.

Aplicar apenas os seguintes aprimoramentos:

Centralizar tracking

Mover toda lógica de impression e click para o hook useSponsorsBySlot, com deduplicação interna.

Utilizar track_sponsor_metric como padrão.

As funções trackImpression e trackClick devem ser retornadas pelo hook de forma opcional e fácil de consumir, podendo ser repassadas como callback para componentes sem exigir refatoração estrutural.

Evitar dependência direta de window

Garantir que page_path seja obtido de forma segura (com fallback), evitando dependência direta de window.location quando não disponível.

Corrigir useRemainingSlots

Substituir valores hardcoded por leitura de POSITION_CONFIG, mantendo consistência com o restante do sistema.

Evitar expansão futura de mapeamentos manuais fora do config.

Suporte opcional a segmentação futura

Permitir parâmetros opcionais (city, category) no hook, sem alterar o comportamento atual quando não utilizados.

Garantir consistência total

Todas as regras (limites, ordem, requiresImage, etc.) devem vir exclusivamente de POSITION_CONFIG, sem duplicações.

Não alterar nenhuma outra lógica, estrutura ou comportamento existente. Apenas aplicar essas melhorias de forma incremental e segura.