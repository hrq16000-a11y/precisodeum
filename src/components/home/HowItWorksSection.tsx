import { howItWorks } from '@/data/mockData';

const HowItWorksSection = () => (
  <section className="py-10">
    <div className="container">
      <div className="mb-10 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Como Funciona</h2>
        <p className="mt-2 text-muted-foreground">Simples, rápido e seguro</p>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {howItWorks.map((item) => (
          <div key={item.step} className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
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
);

export default HowItWorksSection;
