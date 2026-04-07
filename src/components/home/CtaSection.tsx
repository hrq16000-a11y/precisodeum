import { ArrowRight, Megaphone, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import FadeInSection from '@/components/FadeInSection';

const CtaSection = () => (
  <>
    {/* Mid CTA - Services + Jobs */}
    <section className="py-12">
      <div className="container">
        <div className="grid gap-5 md:grid-cols-2">
          <FadeInSection direction="left">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-8 text-center transition-all duration-500 hover:border-primary/40 hover:shadow-lg">
              <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/5 transition-transform duration-700 group-hover:scale-150" />
              <h2 className="relative font-display text-xl font-bold text-foreground md:text-2xl">
                <Sparkles className="inline h-5 w-5 mr-1 text-primary" />
                Quer mais clientes?
              </h2>
              <p className="relative mx-auto mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
                Cadastre seus serviços gratuitamente e comece a receber solicitações na sua região.
              </p>
              <Button variant="accent" size="lg" className="relative mt-5 rounded-full shadow-md" asChild>
                <Link to="/cadastro">Cadastrar serviço <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </FadeInSection>
          <FadeInSection direction="right">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 p-8 text-center transition-all duration-500 hover:border-accent/40 hover:shadow-lg">
              <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-accent/5 transition-transform duration-700 group-hover:scale-150" />
              <h2 className="relative font-display text-xl font-bold text-foreground md:text-2xl">
                <Megaphone className="inline h-5 w-5 mr-1 text-accent" />
                Tem uma vaga?
              </h2>
              <p className="relative mx-auto mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
                Publique uma vaga ou oportunidade e encontre o profissional ideal rapidamente.
              </p>
              <Button variant="accent" size="lg" className="relative mt-5 rounded-full shadow-md" asChild>
                <Link to="/dashboard/vagas">Cadastre uma vaga <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </FadeInSection>
        </div>
      </div>
    </section>

    {/* Final CTA */}
    <section className="py-14 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container text-center">
        <FadeInSection>
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            Pronto para encontrar o profissional ideal?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Milhares de profissionais esperando para atender você.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button variant="hero" size="xl" className="rounded-full shadow-lg" asChild>
              <Link to="/buscar">Buscar Profissional</Link>
            </Button>
            <Button variant="outline" size="xl" className="rounded-full" asChild>
              <Link to="/cadastro">Sou Profissional</Link>
            </Button>
          </div>
        </FadeInSection>
      </div>
    </section>
  </>
);

export default CtaSection;
