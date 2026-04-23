
Vou implementar usando a logo atual do projeto como imagem base.

## O que será feito

1. **Gerar ícones web/PWA a partir da logo atual**
   - Usar a imagem configurada em `src/lib/siteAssets.ts` como fonte.
   - Gerar PNGs nos tamanhos padrão:
     - `16x16`
     - `32x32`
     - `48x48`
     - `72x72`
     - `96x96`
     - `128x128`
     - `144x144`
     - `152x152`
     - `167x167`
     - `180x180`
     - `192x192`
     - `384x384`
     - `512x512`
   - Gerar também `favicon.ico` com múltiplos tamanhos internos.
   - Salvar tudo em `public/icons/` com nomes versionados por hash, para evitar cache antigo.

2. **Atualizar o `manifest.json`**
   - Atualizar:
     - `name`: `Preciso de um Profissional`
     - `short_name`: `Preciso de Um`
     - `start_url`: `/?source=pwa`
     - `theme_color`: `#F97316`
     - `background_color`: `#ffffff`
   - Substituir os ícones atuais pelos arquivos recém-gerados.
   - Incluir ícones PWA principais com `purpose: "any maskable"`.
   - Atualizar os ícones dos atalhos do app para apontarem para os novos arquivos versionados.

3. **Atualizar o `<head>` global**
   - Atualizar `index.html`, que atende tanto páginas públicas quanto dashboards.
   - Adicionar/ajustar:
     - `favicon.ico`
     - PNG favicons
     - `apple-touch-icon` para cada tamanho Apple gerado
     - `manifest`
     - `theme-color`
     - `apple-mobile-web-app-title`
   - Aplicar cache-busting nos links do head usando versão/hash.

4. **Gerar startup images para iOS**
   - Criar imagens de inicialização com a logo centralizada sobre o fundo do app.
   - Gerar tamanhos comuns para iPhone/iPad, incluindo orientações principais.
   - Adicionar tags:
     ```html
     <link rel="apple-touch-startup-image" ...>
     ```
   - Usar media queries adequadas para largura, altura, device pixel ratio e orientação.

5. **Adicionar automação**
   - Criar um script dedicado, por exemplo:
     ```text
     scripts/generate-pwa-icons.mjs
     ```
   - O script irá:
     - Ler a logo atual.
     - Gerar PNGs, ICO e startup images.
     - Calcular hash/versionamento.
     - Atualizar `public/manifest.json`.
     - Atualizar o bloco de ícones no `index.html`.
     - Validar se todos os arquivos referenciados existem.

6. **Ajustar cache**
   - Atualizar `public/_headers` para garantir que:
     - ícones versionados possam usar cache longo.
     - `manifest.json` continue revalidando corretamente.
     - `favicon.ico` não fique preso em cache antigo sem controle.
   - Usar nomes com hash e/ou query string versionada nos links críticos.

7. **Validação**
   - Executar o script de geração.
   - Conferir se todos os caminhos do `head` e do `manifest.json` apontam para arquivos existentes.
   - Validar o build do projeto.
   - Confirmar que os ícones ficam disponíveis para:
     - páginas públicas
     - dashboards
     - instalação PWA
     - Apple touch icon
     - favicon padrão do navegador
     - startup images iOS

## Arquivos que serão alterados

```text
index.html
public/manifest.json
public/_headers
package.json
scripts/generate-pwa-icons.mjs
public/icons/*
public/favicon.ico
```

## Observações técnicas

- Não vou adicionar novo Service Worker nem alterar a política PWA atual além dos ícones/metadados solicitados.
- Como o app é SPA, atualizar o `index.html` garante consistência em dashboards e páginas públicas.
- A geração usará `sharp`, que já existe nas dependências do projeto.
- O versionamento será derivado do conteúdo da logo/ícones para evitar que navegadores mantenham favicons antigos.
