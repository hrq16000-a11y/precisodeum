import { ArrowRight, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CtaSection = () => (
  <>
    {/* Mid CTA - Services + Jobs */}
    <section className="py-10">
      <div className="container">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-primary/5 border border-primary/20 p-8 text-center">
            <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
              Quer mais clientes?
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Cadastre seus serviços gratuitamente e comece a receber solicitações na sua região.
            </p>
            <Button variant="accent" size="lg" className="mt-4 rounded-full" asChild>
              <Link to="/cadastro">Cadastrar serviço <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="rounded-2xl bg-accent/5 border border-accent/20 p-8 text-center">
            <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
              <Megaphone className="inline h-5 w-5 mr-1 text-accent" />
              Tem uma vaga?
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Publique uma vaga ou oportunidade e encontre o profissional ideal rapidamente.
            </p>
            <Button variant="accent" size="lg" className="mt-4 rounded-full" asChild>
              <Link to="/dashboard/vagas">Cadastre uma vaga <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </section>

    {/* Final CTA */}
    <section className="py-10">
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
  </>
);

export default CtaSection;
