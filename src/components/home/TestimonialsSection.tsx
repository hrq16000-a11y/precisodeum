import StarRating from '@/components/StarRating';
import { testimonials } from '@/data/mockData';

const TestimonialsSection = () => (
  <section className="py-10">
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
);

export default TestimonialsSection;
