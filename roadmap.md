# Roadmap — SEO, Moderação, Telemetria e Admin

## Incidente de estabilidade — 2026-09-02

- [x] Correlacionar códigos da tela fatal com `error_reports` e logs publicados.
- [x] Eliminar corrida de dupla assinatura Realtime no status de onboarding.
- [x] Eliminar corrida do canal Realtime de engajamento no pós-cadastro/dashboard.
- [x] Corrigir vazamento do canal de status do prestador na etapa final do Wizard.
- [x] Isolar recuperação de senha de acesso a `window` durante SSR.
- [x] Consolidar o conflito de rotas `/servico/:slug` em um único proprietário.
- [x] Confirmar anúncios públicos pela projeção segura `sponsors_public`.
- [x] Revalidar grants de PII em agências, vagas e prestadores.
- [ ] Publicar e acompanhar recorrência por versão/build durante 24 horas.

Prioridade adotada: **MVP = Sitemap + Canonical + Moderação de avaliações** (esta iteração).
Demais blocos ficam listados como tickets prontos para as próximas iterações.

## Fase 1 — MVP (concluído nesta iteração)

- [x] **SEO-01 · Sitemaps servidos em XML real**
  `/sitemap.xml` (índice) e `/sitemap?type=...&page=N` agora são rotas de servidor
  que entregam XML com `Content-Type` correto, ETag e cache. Antes havia redirect
  client-side (crawler recebia HTML vazio). Gerador continua único.
  Aceite: `curl -I /sitemap.xml` → 200 `application/xml`; índice cobre static,
  categories, especialidades, providers, companies, cities, neighborhoods, blog,
  jobs, pages, popular, seo, seo-cep.
- [x] **SEO-02 · Remoção do sitemap estático** (`public/sitemap.xml`) que sombreava
  a rota dinâmica e ficava defasado.
- [x] **MOD-01 · Avaliações só aparecem se aprovadas**
  Perfil público e contadores do prestador passam a filtrar `approval_status = 'approved'`
  (o admin já tinha aprovar/rejeitar em `/admin/avaliacoes`).

## Fase 2 — SEO avançado

- [ ] **SEO-03** Robots dinâmico por ambiente (preview `noindex`, produção liberado).
- [ ] **SEO-04** `/buscar` SEO-friendly: URLs canônicas por categoria+cidade e
      `noindex` reforçado em recortes finos.
- [ ] **SEO-05** Schema.org `LocalBusiness` / `ProfessionalService` no perfil e
      `BreadcrumbList` em todas as landings regionais/bairro.
- [ ] **SEO-06** Monitor de cobertura: alerta quando sub-sitemap fica vazio.

## Fase 3 — Conversão e telemetria

- [ ] **TEL-01** Telemetria segmentada por bairro nas landings.
- [ ] **TEL-02** A/B testing de CTA (WhatsApp vs formulário) com métricas por variante.
- [ ] **TEL-03** Export CSV dos relatórios de conversão no admin.

## Fase 4 — Admin e UX

- [ ] **ADM-01** Header unificado entre dashboards (admin, patrocinador, usuário).
- [ ] **ADM-02** Painel "Saúde do Sistema" consolidando GSC, e-mail e integridade.
- [ ] **UX-01** Correções mobile na Home.
- [ ] **UX-02** Mensagens de upload mais claras (erro, tamanho, formato).
