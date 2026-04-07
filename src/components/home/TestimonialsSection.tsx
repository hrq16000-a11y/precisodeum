import { Quote } from 'lucide-react';
import StarRating from '@/components/StarRating';
import { testimonials } from '@/data/mockData';
import FadeInSection from '@/components/FadeInSection';

const TestimonialsSection = () => (
  <section className="py-14 bg-muted/30">
    <div className="container">
      <FadeInSection className="mb-10 text-center">
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
          Depoimentos
        </span>
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">O que dizem nossos usuários</h2>
      </FadeInSection>
      <div className="grid gap-5 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <FadeInSection key={i} delay={i * 0.12}>
            <div className="group relative rounded-xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1">
              <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10 transition-colors group-hover:text-primary/20" />
              <StarRating rating={t.rating} showValue={false} size={14} />
              <p className="mt-4 text-sm text-foreground leading-relaxed">"{t.text}"</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {t.name.charAt(0)}
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-foreground">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{t.city}</span>
                </div>
              </div>
            </div>
          </FadeInSection>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
