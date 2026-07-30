# Guia de migração externa independente

## Pré-voo
- Confirme que o GitHub contém o commit mais recente do código, workflows, `supabase/functions` e `supabase/migrations`.
- Gere o dump completo do banco pela área de exportação do backend atual.
- Prepare no destino as variáveis `TARGET_SUPABASE_URL` e `TARGET_SUPABASE_SERVICE_ROLE_KEY` somente no ambiente seguro de CI/servidor.
- Configure as variáveis públicas do frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`.
- Configure segredos backend: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` quando push estiver ativo.

## Exportação por `user_ref`
```bash
SOURCE_SUPABASE_URL="https://origem..." \
SOURCE_SUPABASE_SERVICE_ROLE_KEY="..." \
npm run portability:export-media -- ./backup/portability-user-ref-media.zip
```

O ZIP contém `manifest.json`, arquivos em `storage/<bucket>/<path>`, logs JSONL e relatório de cobertura. A métrica crítica é `media_active_without_user_ref = 0`.

## Restore no destino
1. Restaure primeiro o dump SQL completo no banco externo.
2. Crie buckets equivalentes (`avatars`, `portfolio`, `service-images`, `sponsors`, `sponsor_assets`) com a mesma política público/privado.
3. Faça upload dos arquivos:
```bash
TARGET_SUPABASE_URL="https://destino..." \
TARGET_SUPABASE_SERVICE_ROLE_KEY="..." \
npm run portability:restore-media -- ./backup/portability-user-ref-media.zip
```

## Validação final
```bash
TARGET_SUPABASE_URL="https://destino..." \
TARGET_SUPABASE_SERVICE_ROLE_KEY="..." \
npm run portability:validate-restore -- ./backup/portability-user-ref-media.zip
```

Critérios de aprovação:
- `files_failed = 0`.
- `active_media_without_user_ref = 0`.
- checksums SHA-256 iguais entre origem e destino.
- smoke visual: home, busca, perfil público, avatar e imagens de portfólio carregando no domínio final.

## Observação sobre dependência de ambiente original
O código, migrations, funções e scripts ficam no GitHub. Segredos privados e dump de dados não ficam no repositório por segurança; devem ser fornecidos no CI/hosting externo como variáveis de ambiente e artefatos protegidos.