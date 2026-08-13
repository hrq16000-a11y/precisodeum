/**
 * /preview/guia — Preview isolado do MODO GUIA COMERCIAL.
 *
 * Renderiza apenas catálogo + conteúdo + formulário de lead, com os recursos
 * do portal (chat, dashboard, gamificação, vagas, cursos, notificações)
 * desligados. O override do modo guia é aplicado só enquanto esta rota está
 * montada e revertido no unmount — o portal real não é afetado.
 *
 * Rota noindex por definição (não entra no sitemap, bloqueada no robots.txt).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, X, LayoutGrid, FileText, Send, Megaphone, ArrowRight,
} from 'lucide-react';
import { useSeoHead } from '@/hooks/useSeoHead';
import { BRAND } from '@/config/brand';
import {
  GUIDE_MODE_DISABLED_FEATURES,
  GUIDE_MODE_ENABLED_FEATURES,
  isFeatureEnabled,
  setGuideModeOverride,
} from '@/config/guideMode';
import { resolveSponsorSlots, type SponsorPageKind } from '@/config/sponsorSlots';
import { POSITION_CONFIG } from '@/config/sponsorPositions';
import { buildContentBlocks } from '@/lib/seo/seoContentBlocks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { GuideSlotMatrix } from '@/components/seo/GuideSlotMatrix';

const DEMO_CATALOG = [
  { name: 'Eletricista', slug: 'eletricista', city: 'Curitiba' },
  { name: 'Encanador', slug: 'encanador', city: 'Curitiba' },
  { name: 'Pintor', slug: 'pintor', city: 'São José dos Pinhais' },
  { name: 'Diarista', slug: 'diarista', city: 'Curitiba' },
  { name: 'Chaveiro 24h', slug: 'chaveiro', city: 'Pinhais' },
  { name: 'Montador de móveis', slug: 'montador-de-moveis', city: 'Colombo' },
];

const PAGE_KINDS: SponsorPageKind[] = ['home', 'category', 'city', 'category_city'];

const GuidePreviewPage = () => {
  const [pageKind, setPageKind] = useState<SponsorPageKind>('category_city');
  const [sent, setSent] = useState(false);

  useSeoHead({
    title: 'Preview do modo guia comercial',
    description:
      'Ambiente interno de preview do modo guia comercial: catálogo, conteúdo e formulário de lead com os recursos do portal desligados.',
    noindex: true,
  });

  // Override escopado: só vale enquanto esta página está montada.
  useEffect(() => {
    setGuideModeOverride(true);
    return () => setGuideModeOverride(null);
  }, []);

  const contentBlocks = useMemo(
    () =>
      buildContentBlocks({
        categoryName: 'Eletricista',
        cityName: 'Curitiba',
        citySlug: 'curitiba',
        providersCount: 8,
      }),
    [],
  );

  const slots = useMemo(
    () => resolveSponsorSlots(pageKind, { guideMode: true }),
    [pageKind],
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-10">
      <header className="space-y-3">
        <Badge variant="secondary" className="uppercase tracking-wide">Preview interno · noindex</Badge>
        <h1 className="text-3xl font-bold text-foreground text-balance">
          Modo guia comercial — {BRAND.name}
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Visualização de como o portal se comporta como guia comercial: catálogo indexável,
          conteúdo SEO e captação de lead. Nada aqui altera o portal em produção.
        </p>
      </header>

      {/* Recursos ligados/desligados */}
      <section aria-labelledby="features-title" className="space-y-4">
        <h2 id="features-title" className="text-xl font-semibold">Recursos no modo guia</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="mb-3 flex items-center gap-2 font-medium"><Check className="h-4 w-4 text-primary" /> Ativos</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {GUIDE_MODE_ENABLED_FEATURES.map((f) => (
                <li key={f} data-testid={`guide-feature-on-${f}`}>{f}</li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <p className="mb-3 flex items-center gap-2 font-medium"><X className="h-4 w-4 text-destructive" /> Desligados</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {GUIDE_MODE_DISABLED_FEATURES.map((f) => (
                <li key={f} data-testid={`guide-feature-off-${f}`}>
                  {f} {isFeatureEnabled(f) ? '(ativo)' : '(oculto)'}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* Catálogo */}
      <section aria-labelledby="catalog-title" className="space-y-4" data-testid="guide-catalog">
        <h2 id="catalog-title" className="flex items-center gap-2 text-xl font-semibold">
          <LayoutGrid className="h-5 w-5" /> Catálogo
        </h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
          {DEMO_CATALOG.map((item) => (
            <Card key={item.slug} className="p-4 transition-shadow hover:shadow-md">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.city}</p>
              <Link
                to={`/categoria/${item.slug}`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Ver profissionais <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Conteúdo */}
      <section aria-labelledby="content-title" className="space-y-4" data-testid="guide-content">
        <h2 id="content-title" className="flex items-center gap-2 text-xl font-semibold">
          <FileText className="h-5 w-5" /> Conteúdo SEO
        </h2>
        {contentBlocks.length === 0 ? (
          <p className="text-muted-foreground">Sem conteúdo elegível (guard de thin content ativo).</p>
        ) : (
          contentBlocks.map((block) => (
            <article key={block.kind} className="space-y-2">
              <h3 className="text-lg font-semibold">{block.title}</h3>
              {block.paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
              ))}
            </article>
          ))
        )}
      </section>

      {/* Slots de patrocinador */}
      <section aria-labelledby="slots-title" className="space-y-4" data-testid="guide-slots">
        <h2 id="slots-title" className="flex items-center gap-2 text-xl font-semibold">
          <Megaphone className="h-5 w-5" /> Slots de patrocinador
        </h2>
        <div className="flex flex-wrap gap-2">
          {PAGE_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant={kind === pageKind ? 'default' : 'outline'}
              onClick={() => setPageKind(kind)}
            >
              {kind}
            </Button>
          ))}
        </div>
        <ol className="space-y-2">
          {slots.map((slot) => (
            <li
              key={slot.position}
              data-testid={`guide-slot-${slot.position}`}
              data-order={slot.order}
              className="w-full max-w-full overflow-hidden rounded-lg border border-dashed border-border p-4"
            >
              <p className="font-medium">{POSITION_CONFIG[slot.position].label}</p>
              <p className="text-sm text-muted-foreground">
                ordem {slot.order} · até {slot.maxItems} itens · {POSITION_CONFIG[slot.position].dimensions}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <GuideSlotMatrix />

      {/* Lead */}
      <section aria-labelledby="lead-title" className="space-y-4" data-testid="guide-lead">
        <h2 id="lead-title" className="flex items-center gap-2 text-xl font-semibold">
          <Send className="h-5 w-5" /> Formulário de lead
        </h2>
        <Card className="p-4">
          {sent ? (
            <p className="text-sm text-primary">Preview: lead capturado (nenhum dado foi enviado).</p>
          ) : (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              <Input placeholder="Seu nome" aria-label="Seu nome" />
              <Input placeholder="WhatsApp" aria-label="WhatsApp" inputMode="tel" />
              <Textarea
                placeholder="O que você precisa?"
                aria-label="O que você precisa"
                className="sm:col-span-2"
              />
              <Button type="submit" className="sm:col-span-2">Pedir orçamento</Button>
            </form>
          )}
        </Card>
      </section>
    </main>
  );
};

export default GuidePreviewPage;
