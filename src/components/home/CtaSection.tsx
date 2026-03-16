import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CtaSection = () => (
  <>
    {/* Mid CTA */}
    <section className="py-14">
      <div className="container">
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-8 md:p-12 text-center">
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            Quer mais clientes?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Cadastre seus serviços gratuitamente e comece a receber solicitações de clientes na sua região.
          </p>
          <Button variant="accent" size="xl" className="mt-6 rounded-full" asChild>
            <Link to="/cadastro">Cadastrar serviço <ArrowRight className="h-5 w-5" /></Link>
          </Button>
        </div>
      </div>
    </section>

    {/* Final CTA */}
    <section className="py-14">
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
