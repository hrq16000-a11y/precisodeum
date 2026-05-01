import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { ArrowUpDown, Sparkles, Compass, Star, Award, GraduationCap, Trophy, Link2, Share2, ChevronRight, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Guia público explicando como funciona a ordenação em /buscar e como
 * compartilhar resultados via parâmetros de URL (?ordem=, ?cidade=, ?cep=).
 *
 * Mantemos uma única fonte de verdade entre o conteúdo renderizado e o JSON-LD
 * (FAQPage) para garantir paridade entre o que o usuário lê e o que o Google
 * indexa para rich-snippets.
 */
const SORT_OPTIONS: Array<{
  param: string;
  label: string;
  hint: string;
  icon: typeof Star;
  example: string;
}> = [
  {
    param: 'best',
    label: 'Melhor combinação',
    hint: 'Score híbrido entre avaliação e proximidade (configurável pelo admin).',
    icon: Sparkles,
    example: '/buscar?categoria=eletricista&ordem=best',
  },
  {
    param: 'nearest',
    label: 'Mais perto',
    hint: 'Distância em km a partir do seu GPS ou CEP informado.',
    icon: Compass,
    example: '/buscar?cidade=Curitiba&ordem=nearest',
  },
  {
    param: 'rating',
    label: 'Melhor avaliação',
    hint: 'Profissionais com maior média de avaliação primeiro.',
    icon: Star,
    example: '/buscar?categoria=encanador&ordem=rating',
  },
  {
    param: 'reviews',
    label: 'Mais avaliações',
    hint: 'Quem tem mais clientes avaliando aparece primeiro.',
    icon: Award,
    example: '/buscar?categoria=pintor&ordem=reviews',
  },
  {
    param: 'experience',
    label: 'Mais experientes',
    hint: 'Ordena por anos de atuação declarados no perfil.',
    icon: GraduationCap,
    example: '/buscar?categoria=arquiteto&ordem=experience',
  },
  {
    param: 'relevance',
    label: 'Relevância (padrão)',
    hint: 'Combinação editorial considerando perfil completo, atividade recente e qualidade.',
    icon: Trophy,
    example: '/buscar?q=marido%20de%20aluguel',
  },
];

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'O que é "Melhor combinação"?',
    a: 'É um score híbrido que mistura avaliação e distância em uma única nota de 0 a 100. Por padrão, o peso é 70% avaliação e 30% distância — mas o administrador do site pode ajustar via configurações públicas (search_score_weights). Passe o mouse sobre o badge dourado nos cartões para ver os pesos exatos do dia.',
  },
  {
    q: 'Como compartilho um resultado de busca já ordenado?',
    a: 'Toda ordenação fica guardada na URL como o parâmetro ?ordem=. Por exemplo: /buscar?categoria=eletricista&ordem=rating mostra eletricistas ordenados por avaliação. Basta copiar a barra de endereços e enviar o link — quem abrir verá exatamente os mesmos critérios.',
  },
  {
    q: 'Qual a ordenação padrão se eu não informar ?ordem= ?',
    a: 'A página segue uma cascata: 1) o parâmetro ?ordem= da URL (se presente), 2) o padrão definido pelo admin (default_search_sort), 3) "Melhor combinação" se você compartilhou GPS, 4) "Relevância" caso contrário.',
  },
  {
    q: 'Posso combinar ordenação com filtros de cidade ou CEP?',
    a: 'Sim. Os parâmetros são independentes e podem ser combinados livremente: ?cidade=Curitiba&ordem=nearest, ?cep=80000-000&categoria=encanador, ?q=eletricista&cidade=Curitiba&ordem=best. A página mantém todos os filtros ao trocar de ordenação e volta para a página 1 automaticamente.',
  },
  {
    q: 'Por que páginas com ?ordem= ou ?disponivel= não são indexadas no Google?',
    a: 'Para evitar conteúdo duplicado, apenas o canonical raiz (combinação de q + categoria + cidade) é indexado. Filtros voláteis como página, disponibilidade e ordenação são marcados com noindex e apontam canonical para a versão raiz. Isso preserva o ranking SEO sem prejudicar o compartilhamento entre usuários.',
  },
  {
    q: 'Qual a diferença entre ?cidade= e ?cep= ?',
    a: 'O parâmetro ?cidade= filtra pelo nome da cidade (com fuzzy match). O ?cep= é mais preciso: usamos o CEP para resolver cidade, estado e bairro automaticamente, e ainda servimos como ponto de partida para a ordenação por distância quando o GPS não está disponível.',
  },
];

const HelpSearchSortingPage = () => {
  useSeoHead({
    title: 'Como funciona a ordenação da busca | Preciso de um',
    description:
      'Entenda como ordenar profissionais em /buscar (Melhor combinação, Distância, Avaliação) e como compartilhar resultados pela URL com ?ordem=, ?cidade= e ?cep=.',
    canonical: `${SITE_BASE_URL}/ajuda/ordenacao-busca`,
  });

  // FAQPage schema (mesmo conteúdo da UI — paridade total).
  useJsonLd(
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
    'json-ld-faq-search-sorting',
  );

  useJsonLd(
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Central de Ajuda', item: `${SITE_BASE_URL}/ajuda` },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Ordenação da busca',
          item: `${SITE_BASE_URL}/ajuda/ordenacao-busca`,
        },
      ],
    },
    'json-ld-breadcrumb-search-sorting',
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 md:py-12">
        {/* Breadcrumb visual */}
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Início</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/ajuda" className="hover:text-foreground">Central de Ajuda</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Ordenação da busca</span>
        </nav>

        <header className="mb-8">
          <Badge variant="secondary" className="mb-3 inline-flex items-center gap-1.5">
            <ArrowUpDown className="h-3 w-3" /> Guia oficial
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Como funciona a ordenação da busca
          </h1>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            Aprenda a usar os critérios de ordenação em <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/buscar</code> e
            como compartilhar resultados ordenados pela URL.
          </p>
        </header>

        {/* Bloco de critérios */}
        <section className="mb-10" aria-labelledby="criterios">
          <h2 id="criterios" className="mb-4 text-xl font-semibold md:text-2xl">
            Critérios disponíveis
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {SORT_OPTIONS.map(({ param, label, hint, icon: Icon, example }) => (
              <Card key={param} className="border-border/60">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-base font-semibold">{label}</h3>
                    <code className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">?ordem={param}</code>
                  </div>
                  <p className="mb-2 text-sm text-muted-foreground">{hint}</p>
                  <Link
                    to={example.replace(SITE_BASE_URL, '')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Link2 className="h-3 w-3" /> Exemplo: <span className="font-mono">{example}</span>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Como compartilhar */}
        <section className="mb-10" aria-labelledby="compartilhar">
          <h2 id="compartilhar" className="mb-4 flex items-center gap-2 text-xl font-semibold md:text-2xl">
            <Share2 className="h-5 w-5" /> Compartilhando resultados
          </h2>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="space-y-3 p-4 text-sm">
              <p>
                Todos os filtros e a ordenação ficam guardados na URL. Para compartilhar uma busca:
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Aplique os filtros desejados em <Link className="text-primary underline" to="/buscar">/buscar</Link>.</li>
                <li>Escolha a ordenação no chip "Ordenar".</li>
                <li>Copie a URL inteira da barra de endereços.</li>
                <li>Envie o link — quem abrir verá os mesmos resultados e a mesma ordem.</li>
              </ol>
              <div className="mt-3 flex items-start gap-2 rounded-md border border-border/60 bg-background/60 p-3 text-xs">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>
                  <strong>Dica:</strong> ao trocar de ordenação a página volta para <code className="rounded bg-muted px-1 py-0.5">page=1</code> automaticamente,
                  preservando todos os outros filtros (cidade, CEP, categoria, busca livre).
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Parâmetros suportados */}
        <section className="mb-10" aria-labelledby="parametros">
          <h2 id="parametros" className="mb-4 text-xl font-semibold md:text-2xl">
            Parâmetros de URL suportados
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Parâmetro</th>
                  <th className="px-3 py-2 font-semibold">O que faz</th>
                  <th className="px-3 py-2 font-semibold">Exemplo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr><td className="px-3 py-2 font-mono">q</td><td className="px-3 py-2">Busca livre por texto</td><td className="px-3 py-2 font-mono text-xs">?q=eletricista</td></tr>
                <tr><td className="px-3 py-2 font-mono">categoria</td><td className="px-3 py-2">Slug da categoria</td><td className="px-3 py-2 font-mono text-xs">?categoria=encanador</td></tr>
                <tr><td className="px-3 py-2 font-mono">cidade</td><td className="px-3 py-2">Nome da cidade</td><td className="px-3 py-2 font-mono text-xs">?cidade=Curitiba</td></tr>
                <tr><td className="px-3 py-2 font-mono">cep</td><td className="px-3 py-2">CEP (resolve cidade/UF/bairro)</td><td className="px-3 py-2 font-mono text-xs">?cep=80000-000</td></tr>
                <tr><td className="px-3 py-2 font-mono">uf</td><td className="px-3 py-2">Sigla do estado</td><td className="px-3 py-2 font-mono text-xs">?uf=PR</td></tr>
                <tr><td className="px-3 py-2 font-mono">ordem</td><td className="px-3 py-2">Critério de ordenação</td><td className="px-3 py-2 font-mono text-xs">?ordem=best</td></tr>
                <tr><td className="px-3 py-2 font-mono">disponivel</td><td className="px-3 py-2">Janela de disponibilidade</td><td className="px-3 py-2 font-mono text-xs">?disponivel=today</td></tr>
                <tr><td className="px-3 py-2 font-mono">page</td><td className="px-3 py-2">Página (paginação)</td><td className="px-3 py-2 font-mono text-xs">?page=2</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-10" aria-labelledby="faq">
          <h2 id="faq" className="mb-4 text-xl font-semibold md:text-2xl">Perguntas frequentes</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="rounded-lg border border-border/60 bg-card p-4 [&[open]>summary]:mb-2">
                <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 transition-transform [details[open]_&]:rotate-90" />
                    {item.q}
                  </span>
                </summary>
                <p className="pl-6 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
          <span className="text-muted-foreground">Próximos passos:</span>
          <Link to="/buscar" className="font-medium text-primary hover:underline">Ir para /buscar</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/ajuda" className="font-medium text-primary hover:underline">Central de Ajuda</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/ajuda/online-offline" className="font-medium text-primary hover:underline">Online/Offline</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HelpSearchSortingPage;
