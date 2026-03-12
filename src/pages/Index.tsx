import { motion } from 'framer-motion';
import { ArrowRight, Shield, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroImage from '@/assets/hero-image.jpg';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchBar from '@/components/SearchBar';
import CategoryCard from '@/components/CategoryCard';
import ProviderCard from '@/components/ProviderCard';
import StarRating from '@/components/StarRating';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoriesWithCount, useFeaturedProviders } from '@/hooks/useProviders';
import { testimonials, howItWorks } from '@/data/mockData';

const Index = () => {
  const { data: categories = [], isLoading: catsLoading } = useCategoriesWithCount();
  const { data: featuredProviders = [], isLoading: provsLoading } = useFeaturedProviders();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero py-20 md:py-28">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(25_95%_53%/0.15),transparent_60%)]" />
        <div className="container relative z-10 flex flex-col items-center text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-4xl font-extrabold tracking-tight text-primary-foreground md:text-6xl lg:text-7xl"
          >
            Preciso de um
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-4 max-w-lg text-lg text-primary-foreground/70 md:text-xl"
          >
            Encontre profissionais confiáveis perto de você.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 w-full max-w-2xl"
          >
            <SearchBar />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-primary-foreground/50"
          >
            <span className="flex items-center gap-1"><Shield className="h-4 w-4" /> Profissionais verificados</span>
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> +10.000 cadastrados</span>
            <span className="flex items-center gap-1"><Zap className="h-4 w-4" /> Resposta rápida</span>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="container">
          <div className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Categorias Populares</h2>
            <p className="mt-2 text-muted-foreground">Encontre o profissional ideal para o serviço que você precisa</p>
          </div>
          {catsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {categories.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Providers */}
      <section className="bg-muted/50 py-16">
        <div className="container">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Profissionais em Destaque</h2>
              <p className="mt-2 text-muted-foreground">Os mais bem avaliados da plataforma</p>
            </div>
            <Button variant="ghost" className="hidden md:flex" asChild>
              <Link to="/buscar">Ver todos <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          {provsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : featuredProviders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum profissional em destaque ainda.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredProviders.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </div>
          )}
          <div className="mt-6 text-center md:hidden">
            <Button variant="outline" asChild>
              <Link to="/buscar">Ver todos os profissionais</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Como Funciona</h2>
            <p className="mt-2 text-muted-foreground">Simples, rápido e seguro</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {howItWorks.map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-3xl">
                  {item.icon}
                </div>
                <div className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {item.step}
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Become a Provider CTA */}
      <section className="bg-hero py-16">
        <div className="container text-center">
          <h2 className="font-display text-2xl font-bold text-primary-foreground md:text-3xl">
            É profissional? Cadastre-se gratuitamente
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-primary-foreground/70">
            Aumente sua visibilidade, receba clientes e cresça seu negócio com a maior plataforma de serviços do Brasil.
          </p>
          <Button variant="hero" size="xl" className="mt-6 rounded-full" asChild>
            <Link to="/cadastro">Quero me cadastrar <ArrowRight className="h-5 w-5" /></Link>
          </Button>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16">
        <div className="container">
          <div className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">O que dizem nossos usuários</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-card">
                <StarRating rating={t.rating} showValue={false} size={14} />
                <p className="mt-3 text-sm text-foreground">"{t.text}"</p>
                <div className="mt-4 text-sm">
                  <span className="font-semibold text-foreground">{t.name}</span>
                  <span className="text-muted-foreground"> — {t.city}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-muted/50 py-16">
        <div className="container max-w-2xl">
          <h2 className="mb-8 text-center font-display text-2xl font-bold text-foreground md:text-3xl">Perguntas Frequentes</h2>
          {[
            { q: 'Como encontro um profissional?', a: 'Use a barra de busca para pesquisar pelo serviço e sua cidade. Você verá uma lista de profissionais verificados com avaliações.' },
            { q: 'O cadastro é gratuito?', a: 'Sim! Profissionais podem se cadastrar gratuitamente no plano básico. Planos PRO e Premium oferecem mais visibilidade.' },
            { q: 'Como funciona a avaliação?', a: 'Após contratar um serviço, você pode avaliar o profissional com notas de 1 a 5 estrelas em qualidade, pontualidade e atendimento.' },
            { q: 'É seguro contratar pela plataforma?', a: 'Todos os profissionais passam por verificação. Além disso, as avaliações de outros clientes ajudam na sua decisão.' },
          ].map((faq, i) => (
            <details key={i} className="group mb-3 rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">
                {faq.q}
              </summary>
              <p className="px-5 pb-4 text-sm text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16">
        <div className="container text-center">
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            Pronto para encontrar o profissional ideal?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Milhares de profissionais esperando para atender você.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button variant="hero" size="xl" className="rounded-full" asChild>
              <Link to="/buscar">Buscar Profissional</Link>
            </Button>
            <Button variant="outline" size="xl" className="rounded-full" asChild>
              <Link to="/cadastro">Sou Profissional</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
