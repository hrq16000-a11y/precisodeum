import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { buildFaqPage, buildBreadcrumbList } from '@/lib/seo-schemas';
import { Activity, Clock, Eye, EyeOff, ShieldCheck, Wifi, WifiOff, ChevronRight } from 'lucide-react';

// Single source of truth for both the rendered FAQ and the schema.org JSON-LD —
// guarantees parity between what users read and what Google ingests.
const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'O que significa o badge "Online" no perfil de um profissional?',
    a: 'O profissional está conectado neste momento, com o app ou site aberto e visibilidade ativada. Mostramos um indicador verde pulsante com a hora em que ele se conectou (online_since). Atualizamos o status em tempo real, sem precisar recarregar a página.',
  },
  {
    q: 'O que significa "Offline" e "Visto pela última vez há X"?',
    a: 'O badge Offline aparece apenas quando o profissional saiu há pouco tempo (até 10 minutos por padrão). Mostramos a mensagem "Visto pela última vez há X min" usando o carimbo lastSeen, que é o momento exato em que detectamos a desconexão. Após esse intervalo, o badge desaparece para não passar uma impressão errada.',
  },
  {
    q: 'Quais dados são usados para calcular o status?',
    a: 'Usamos apenas o user_id do profissional, sua cidade (opcional) e dois timestamps: online_since (início da sessão atual) e lastSeen (última desconexão detectada). Não armazenamos histórico, nem coletamos IP ou geolocalização para esse recurso. Tudo fica em memória durante a sessão.',
  },
  {
    q: 'O que acontece se o tempo real falhar?',
    a: 'Se o canal de tempo real ficar indisponível, ocultamos automaticamente os badges Online/Offline e o filtro de Status. A busca continua funcionando normalmente por avaliação, distância e relevância — sem quebrar a ordenação dos resultados.',
  },
  {
    q: 'Como o status influencia minha busca em /buscar?',
    a: 'O modo padrão "Online primeiro" mantém a ordenação que você escolheu (distância, avaliação ou relevância) e apenas sobe os profissionais online ao topo de cada grupo. Você também pode escolher "Apenas Online" (somente quem está conectado agora) ou "Recentemente Offline" (saíram há poucos minutos).',
  },
  {
    q: 'Profissional: como controlar minha visibilidade?',
    a: 'No painel, em "Status — Trabalhando agora", você pode desativar o modo visível a qualquer momento. Quando invisível, seu cartão deixa de mostrar o badge verde, mas seus serviços continuam aparecendo nas buscas normalmente. Sua preferência fica salva no seu dispositivo.',
  },
];

const HelpOnlineOfflinePage = () => {
  useSeoHead({
    title: 'Como funciona Online/Offline | Preciso de um',
    description:
      'Entenda como o status "Online" e "Offline" dos profissionais funciona no Preciso de um, quais dados são usados (online_since e lastSeen) e como o tempo real influencia a busca.',
    canonical: `${SITE_BASE_URL}/ajuda/online-offline`,
  });

  // FAQPage schema for rich-snippet eligibility — via helper centralizado.
  useJsonLd(
    buildFaqPage(FAQ_ITEMS.map((it) => ({ question: it.q, answer: it.a }))),
    'json-ld-faq-online-offline',
  );

  // BreadcrumbList schema — via helper centralizado.
  useJsonLd(
    buildBreadcrumbList([
      { name: 'Início', url: SITE_BASE_URL },
      { name: 'Central de Ajuda', url: `${SITE_BASE_URL}/ajuda` },
      { name: 'Como funciona Online/Offline', url: `${SITE_BASE_URL}/ajuda/online-offline` },
    ]),
    'json-ld-breadcrumb-online-offline',
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-gradient-to-br from-emerald-500/5 via-background to-primary/5 py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          {/* Visual breadcrumbs (mirrors the JSON-LD above) */}
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-foreground">Início</Link>
              </li>
              <li aria-hidden="true"><ChevronRight className="inline h-3 w-3" /></li>
              <li>
                <Link to="/ajuda" className="hover:text-foreground">Central de Ajuda</Link>
              </li>
              <li aria-hidden="true"><ChevronRight className="inline h-3 w-3" /></li>
              <li className="font-medium text-foreground" aria-current="page">
                Online / Offline
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Como funciona Online / Offline
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            O status em tempo real ajuda você a encontrar profissionais que provavelmente vão
            responder agora. Aqui explicamos exatamente como ele funciona, quais dados usamos e
            como você mantém o controle.
          </p>
        </div>
      </section>

      <main className="container mx-auto max-w-3xl px-4 py-10 space-y-8">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <header className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Wifi className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-semibold">O que significa "Online"?</h2>
          </header>
          <p className="mt-3 text-sm text-muted-foreground">
            Um profissional aparece como <strong className="text-foreground">Online</strong> quando
            está com o aplicativo ou site aberto e conectado à internet, com o modo de visibilidade
            ativado. Mostramos um indicador verde pulsante e a hora em que ele se conectou.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <strong className="text-foreground">online_since</strong>: o instante em que a
                sessão atual começou. Se ele recarregar a página, mantemos o horário mais antigo
                para não "zerar" o tempo conectado.
              </span>
            </li>
            <li className="flex gap-2">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Atualizamos o status a cada poucos segundos via tempo real — sem precisar
                recarregar a busca.
              </span>
            </li>
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <header className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <WifiOff className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-semibold">O que significa "Offline"?</h2>
          </header>
          <p className="mt-3 text-sm text-muted-foreground">
            Mostramos o badge <strong className="text-foreground">Offline</strong> apenas quando o
            profissional saiu há pouco tempo (até 10 minutos por padrão), com a mensagem{' '}
            <em>"Visto pela última vez há X min"</em>. Depois desse intervalo, o badge desaparece e
            o card volta ao estado neutro — sem dar a impressão errada de que está ausente há
            muito tempo.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            O carimbo de horário usado é o <strong className="text-foreground">lastSeen</strong>:
            o último momento em que detectamos a conexão dele cair.
          </p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <header className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-semibold">Quais dados usamos</h2>
          </header>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">user_id</strong>, <strong className="text-foreground">cidade</strong>{' '}
              (opcional) e os timestamps <strong className="text-foreground">online_since</strong> e{' '}
              <strong className="text-foreground">lastSeen</strong>.
            </li>
            <li>
              Não armazenamos histórico de presença, IP, geolocalização precisa nem nada que
              identifique terceiros. Tudo fica em memória durante a sessão.
            </li>
            <li>
              Se o tempo real falhar, ocultamos os badges e o filtro de Status — a busca continua
              funcionando normalmente por avaliação, distância e relevância.
            </li>
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <header className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <Eye className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-semibold">Profissional: como controlar minha visibilidade</h2>
          </header>
          <p className="mt-3 text-sm text-muted-foreground">
            No painel, em <strong className="text-foreground">Status "Trabalhando agora"</strong>,
            você pode desativar o modo visível a qualquer momento. Quando invisível, seu cartão
            não mostra o badge verde — mas seus serviços continuam aparecendo nas buscas.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5" /> Sua preferência fica salva no seu dispositivo.
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold">Como o status influencia a busca</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>
              <strong className="text-foreground">Online primeiro</strong> (padrão): mantém a
              ordenação atual (distância, avaliação ou relevância) e apenas sobe os profissionais
              online ao topo de cada grupo.
            </li>
            <li>
              <strong className="text-foreground">Apenas Online</strong>: mostra somente quem está
              conectado neste momento.
            </li>
            <li>
              <strong className="text-foreground">Recentemente Offline</strong>: mostra quem saiu
              há poucos minutos — útil quando você quer alguém que provavelmente vai voltar logo.
            </li>
          </ul>
        </article>

        {/* Plain Q&A list — mirrors the JSON-LD FAQPage above */}
        <section aria-labelledby="faq-heading" className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h2 id="faq-heading" className="text-lg font-semibold">Perguntas frequentes</h2>
          <dl className="mt-4 divide-y divide-border">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="py-3">
                <dt className="text-sm font-medium text-foreground">{item.q}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="text-center">
          <Link
            to="/ajuda"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Voltar para a Central de Ajuda
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HelpOnlineOfflinePage;
