import { DollarSign, Tag } from 'lucide-react';

const popularServices = [
  { name: 'Encanador', category: 'Serviços Hidráulicos', avgPrice: 'R$ 197,12' },
  { name: 'Eletricista', category: 'Serviços Elétricos', avgPrice: 'R$ 177,87' },
  { name: 'Limpeza de Ar-condicionado', category: 'Ar-condicionado', avgPrice: 'R$ 280,22' },
  { name: 'Instalação de Ar-condicionado', category: 'Ar-condicionado', avgPrice: 'R$ 610,96' },
  { name: 'Marido de Aluguel', category: 'Pequenos Reparos', avgPrice: 'R$ 193,24' },
  { name: 'Montagem de Móveis', category: 'Pequenos Reparos', avgPrice: 'R$ 145,50' },
];

const PopularServices = () => (
  <section className="py-14">
    <div className="container">
      <div className="mb-8 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
          Serviços Populares
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Os serviços mais procurados na plataforma
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {popularServices.map((s) => (
          <div
            key={s.name}
            className="rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5"
          >
            <h3 className="font-display text-base font-bold text-foreground">{s.name}</h3>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="h-3.5 w-3.5 text-primary" />
              {s.category}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-accent">Preço médio: {s.avgPrice}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PopularServices;
