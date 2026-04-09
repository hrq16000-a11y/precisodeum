

# Corrigir dimensões e posições dos sponsors para exibição correta na home

## Diagnóstico

Dados atuais dos sponsors no banco:

| Sponsor | position | Onde aparece | Problema |
|---|---|---|---|
| Preciso de um técnico | `hero-top` | LeaderSponsor ✅ | OK |
| Empório Lelecute | `hero-top` | LeaderSponsor ✅ | OK |
| Assistência técnica | `banner` | **Nenhum lugar** ❌ | Nenhum componente filtra `position='banner'` na home. AdBanner filtra `between-sections` e `mid-content` |
| Makita Brasil | `featured` | **Nenhum lugar** ❌ | Nenhum componente filtra `position='featured'` |
| Bosch Professional | `featured` | **Nenhum lugar** ❌ | Idem |
| Balaroti | `card` | SponsorsSection ✅ | OK (filtra `banner`, `card`, `featured`) |
| Quartzolit | `card` | SponsorsSection ✅ | OK |
| Vagas de serviços | `showcase` | AdShowcase ✅ | OK |
| Profissionais Certificados | `showcase` | AdShowcase ✅ | OK |

**SponsorsSection** filtra `position IN ('banner', 'card', 'featured')` — então Makita/Bosch/Assistência **deveriam** aparecer lá. Mas a seção mostra no máximo 3 aleatórios, e eles competem com Balaroti/Quartzolit.

**Problemas reais:**
1. `homepage_sections_order` no banco **não inclui** os slugs `urgency`, `stats`, `sponsor_top`, `sponsor_cta`, `cms_banners` — esses só existem no DEFAULT_ORDER mas são ignorados porque o banco tem um valor customizado que não os lista.
2. `max_width` e `max_height` são `0` para todos os sponsors — isso não causa problema direto (o SponsorImage usa `object-contain` com tamanho natural), mas indica que as imagens uploaded podem ser de baixa resolução.
3. **SponsorsSection** mostra cards pequenos em grid 3-colunas com `aspect-[5/3]`, o que comprime banners horizontais (ex: 1600x200) em caixas quadradas.

## O que será feito

### 1. Atualizar `homepage_sections_order` no banco
Adicionar os slugs faltantes para que todas as seções apareçam:
`cms_banners,urgency,leader_sponsor,sponsor_top,highlights,stats,categories,pwa,dynamic,ad1,featured,popular,ad2,jobs,blog,cities,cta,showcase,sponsors,howitworks,searches,testimonials,faq,sponsor_cta`

### 2. Corrigir positions dos sponsors que não aparecem
- `Assistência técnica em todo Brasil` (`banner` → `card`) — para aparecer no SponsorsSection
- `Makita Brasil` e `Bosch Professional` (`featured` → `card`) — idem, pois `featured` é filtrado pelo SponsorsSection mas compete com poucos slots

Alternativa: manter `featured` e garantir que o SponsorsSection já os inclui (ele já filtra `featured`). O problema real é que mostra só 3 aleatórios. Podemos aumentar para 6.

### 3. Definir `max_width` e `max_height` adequados
Atualizar todos os sponsors ativos com dimensões padrão baseadas na posição:
- `hero-top`: 1600×200
- `showcase`: 1200×675
- `card`/`banner`/`featured`: 600×360

### Arquivos alterados
| Arquivo | Ação |
|---|---|
| Banco de dados | UPDATE `site_settings` e `sponsors` via insert tool |
| `src/components/home/SponsorsSection.tsx` | Aumentar limite de 3 para 6 cards exibidos |

## Detalhes técnicos

- As atualizações de dados serão feitas via insert tool (UPDATE statements)
- Nenhuma migração de schema necessária
- Index02 e Index03 não serão tocados

